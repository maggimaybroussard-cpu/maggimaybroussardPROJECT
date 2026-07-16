import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getGoogleAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || clientId === 'your-google-client-id-here' || !clientSecret || clientSecret === 'your-google-client-secret-here') {
    return null;
  }

  const supabase = getServiceClient();
  const { data: tokenRow } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .limit(1)
    .single();

  if (!tokenRow?.refresh_token) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token ?? null;
}

async function createSpreadsheet(accessToken: string, title: string): Promise<string> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: { title } }),
  });
  const data = await res.json();
  if (!data.spreadsheetId) throw new Error(data.error?.message ?? 'Failed to create spreadsheet');
  return data.spreadsheetId;
}

async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][]
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? 'Failed to write values');
}

async function addSheet(accessToken: string, spreadsheetId: string, title: string): Promise<number> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? 'Failed to add sheet');
  return data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
}

async function formatHeaderRow(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number
): Promise<void> {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.18, green: 0.38, blue: 0.62 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      }),
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { exportType, spreadsheetId: existingSpreadsheetId, dateFrom, dateTo } = body as {
      exportType: 'time_logs' | 'invoices' | 'both';
      spreadsheetId?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google OAuth not connected. Please complete the Google OAuth flow at /api/google-calendar/auth first.' },
        { status: 401 }
      );
    }

    const supabase = getServiceClient();
    const now = new Date();
    const title = `Broussard Legal – Practice Export ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Create or reuse spreadsheet
    let spreadsheetId = existingSpreadsheetId;
    if (!spreadsheetId) {
      spreadsheetId = await createSpreadsheet(accessToken, title);
    }

    const exportedSheets: string[] = [];

    // ── Time Logs ──────────────────────────────────────────────────────────────
    if (exportType === 'time_logs' || exportType === 'both') {
      let query = supabase
        .from('matter_time_logs')
        .select(`
          id,
          inquiry_id,
          hours,
          description,
          work_date,
          logged_by,
          assigned_to,
          billable,
          task_category,
          hourly_rate,
          created_at,
          contact_inquiries (name, email, service)
        `)
        .order('work_date', { ascending: false })
        .limit(2000);

      if (dateFrom) query = query.gte('work_date', dateFrom);
      if (dateTo) query = query.lte('work_date', dateTo);

      const { data: timeLogs, error: tlError } = await query;
      if (tlError) throw new Error(`Time logs fetch error: ${tlError.message}`);

      const timeHeaders = [
        'Date', 'Client Name', 'Client Email', 'Service', 'Hours', 'Billable',
        'Task Category', 'Hourly Rate ($)', 'Amount ($)', 'Description', 'Logged By', 'Assigned To', 'Entry ID',
      ];

      const timeRows: (string | number | null)[][] = (timeLogs ?? []).map((t: Record<string, unknown>) => {
        const ci = t.contact_inquiries as Record<string, string> | null;
        const hours = Number(t.hours) || 0;
        const rate = Number(t.hourly_rate) || 0;
        return [
          t.work_date as string ?? '',
          ci?.name ?? '',
          ci?.email ?? '',
          ci?.service ?? '',
          hours,
          (t.billable as boolean) ? 'Yes' : 'No',
          t.task_category as string ?? '',
          rate || '',
          rate ? Math.round(hours * rate * 100) / 100 : '',
          t.description as string ?? '',
          t.logged_by as string ?? '',
          t.assigned_to as string ?? '',
          t.id as string ?? '',
        ];
      });

      // Add sheet (or use Sheet1 if first)
      let sheetId = 0;
      const sheetTitle = 'Time Logs';
      try {
        sheetId = await addSheet(accessToken, spreadsheetId, sheetTitle);
      } catch {
        // Sheet1 already exists — write to it
        sheetId = 0;
      }

      const sheetRange = `${sheetTitle}!A1`;
      await writeSheetValues(accessToken, spreadsheetId, sheetRange, [timeHeaders, ...timeRows]);
      await formatHeaderRow(accessToken, spreadsheetId, sheetId, timeHeaders.length);
      exportedSheets.push(`Time Logs (${timeRows.length} entries)`);
    }

    // ── Invoices ───────────────────────────────────────────────────────────────
    if (exportType === 'invoices' || exportType === 'both') {
      let query = supabase
        .from('client_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          amount,
          amount_paid,
          status,
          notes,
          inquiry_id,
          created_at,
          contact_inquiries (name, email, service)
        `)
        .order('invoice_date', { ascending: false })
        .limit(2000);

      if (dateFrom) query = query.gte('invoice_date', dateFrom);
      if (dateTo) query = query.lte('invoice_date', dateTo);

      const { data: invoices, error: invError } = await query;
      if (invError) throw new Error(`Invoices fetch error: ${invError.message}`);

      const invHeaders = [
        'Invoice #', 'Invoice Date', 'Due Date', 'Client Name', 'Client Email', 'Service',
        'Amount ($)', 'Amount Paid ($)', 'Balance Due ($)', 'Status', 'Notes', 'Invoice ID',
      ];

      const invRows: (string | number | null)[][] = (invoices ?? []).map((inv: Record<string, unknown>) => {
        const ci = inv.contact_inquiries as Record<string, string> | null;
        const amount = Number(inv.amount) || 0;
        const paid = Number(inv.amount_paid) || 0;
        return [
          inv.invoice_number as string ?? '',
          inv.invoice_date as string ?? '',
          inv.due_date as string ?? '',
          ci?.name ?? '',
          ci?.email ?? '',
          ci?.service ?? '',
          amount,
          paid,
          Math.round((amount - paid) * 100) / 100,
          inv.status as string ?? '',
          inv.notes as string ?? '',
          inv.id as string ?? '',
        ];
      });

      const sheetTitle = 'Invoices';
      let sheetId = 0;
      try {
        sheetId = await addSheet(accessToken, spreadsheetId, sheetTitle);
      } catch {
        sheetId = 0;
      }

      const sheetRange = `${sheetTitle}!A1`;
      await writeSheetValues(accessToken, spreadsheetId, sheetRange, [invHeaders, ...invRows]);
      await formatHeaderRow(accessToken, spreadsheetId, sheetId, invHeaders.length);
      exportedSheets.push(`Invoices (${invRows.length} entries)`);
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return NextResponse.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      exportedSheets,
      message: `Exported: ${exportedSheets.join(', ')}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
