import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getValidToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: token } = await supabase
    .from('clio_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!token) throw new Error('No Clio token found. Please connect Clio first.');

  // Refresh if expired
  if (new Date(token.expires_at) < new Date()) {
    const clientId = process.env.CLIO_CLIENT_ID;
    const clientSecret = process.env.CLIO_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Clio credentials not configured.');

    const refreshRes = await fetch('https://app.clio.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
    });

    if (!refreshRes.ok) throw new Error('Failed to refresh Clio token. Please reconnect.');

    const refreshed = await refreshRes.json();
    const expiresAt = new Date(Date.now() + (refreshed.expires_in ?? 2592000) * 1000).toISOString();

    await supabase.from('clio_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('clio_tokens').insert({
      access_token: refreshed.access_token,
      refresh_token: token.refresh_token,
      token_type: 'bearer',
      expires_at: expiresAt,
      clio_user_id: token.clio_user_id,
      clio_user_name: token.clio_user_name,
      clio_account_id: token.clio_account_id,
    });

    return refreshed.access_token as string;
  }

  return token.access_token as string;
}

async function clioFetch(accessToken: string, path: string) {
  const res = await fetch(`https://app.clio.com/api/v4${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Clio API error (${res.status}): ${txt}`);
  }
  return res.json();
}

async function syncMatters(accessToken: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const fields = 'id,display_number,description,status,client{id,name},practice_area{name},open_date,close_date,responsible_attorney{name},billable,pending_date';
  let page = 1;
  let totalSynced = 0;

  while (true) {
    const data = await clioFetch(
      accessToken,
      `/matters?fields=${encodeURIComponent(fields)}&page=${page}&per_page=200`
    );

    const matters = data.data ?? [];
    if (matters.length === 0) break;

    const rows = matters.map((m: Record<string, unknown>) => ({
      clio_id: m.id,
      display_number: m.display_number,
      description: m.description,
      status: m.status,
      client_name: (m.client as Record<string, unknown>)?.name ?? null,
      client_clio_id: (m.client as Record<string, unknown>)?.id ?? null,
      practice_area: (m.practice_area as Record<string, unknown>)?.name ?? null,
      open_date: m.open_date ?? null,
      close_date: m.close_date ?? null,
      responsible_attorney: (m.responsible_attorney as Record<string, unknown>)?.name ?? null,
      billable: m.billable ?? true,
      pending_date: m.pending_date ?? null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    for (const row of rows) {
      await supabase
        .from('clio_matters')
        .upsert(row, { onConflict: 'clio_id' });
    }

    // Auto-link Notion matter notes for each synced matter (fire-and-forget)
    void linkNotionMatterNotes(matters);

    totalSynced += matters.length;

    if (!data.meta?.paging?.next) break;
    page++;
  }

  return totalSynced;
}

/**
 * Fire-and-forget: link Notion matter notes to each Clio matter.
 * Calls the internal API route so it runs asynchronously without blocking sync.
 */
async function linkNotionMatterNotes(matters: Record<string, unknown>[]) {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey || notionApiKey === 'your-notion-api-key-here') return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  for (const matter of matters.slice(0, 10)) { // limit to 10 per sync to avoid rate limits
    try {
      await fetch(`${siteUrl}/api/notion/link-matter-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clioMatterId: String(matter.clio_id ?? matter.id),
          matterDescription: matter.description ?? '',
          clientName: (matter.client as Record<string, unknown>)?.name ?? '',
        }),
      });
    } catch {
      // Non-blocking — Notion linking failure should not break Clio sync
    }
  }
}

async function syncContacts(accessToken: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const fields = 'id,name,type,email_addresses{address},phone_numbers{number},company{name},title,addresses{street,city,state,zip_code}';
  let page = 1;
  let totalSynced = 0;

  while (true) {
    const data = await clioFetch(
      accessToken,
      `/contacts?fields=${encodeURIComponent(fields)}&page=${page}&per_page=200`
    );

    const contacts = data.data ?? [];
    if (contacts.length === 0) break;

    const rows = contacts.map((c: Record<string, unknown>) => {
      const emails = (c.email_addresses as Array<Record<string, unknown>>) ?? [];
      const phones = (c.phone_numbers as Array<Record<string, unknown>>) ?? [];
      const addresses = (c.addresses as Array<Record<string, unknown>>) ?? [];
      const addr = addresses[0] ?? {};

      return {
        clio_id: c.id,
        name: c.name,
        contact_type: c.type,
        email: emails[0]?.address ?? null,
        phone: phones[0]?.number ?? null,
        company: (c.company as Record<string, unknown>)?.name ?? null,
        title: c.title ?? null,
        address_line1: addr.street ?? null,
        address_city: addr.city ?? null,
        address_state: addr.state ?? null,
        address_zip: addr.zip_code ?? null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    for (const row of rows) {
      await supabase
        .from('clio_contacts')
        .upsert(row, { onConflict: 'clio_id' });
    }

    totalSynced += contacts.length;

    if (!data.meta?.paging?.next) break;
    page++;
  }

  return totalSynced;
}

async function syncTimeEntries(accessToken: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const fields = 'id,date,quantity,quantity_in_hours,price,total,note,billable,billed,matter{id,description},user{name},activity_description{name}';
  let page = 1;
  let totalSynced = 0;

  while (true) {
    const data = await clioFetch(
      accessToken,
      `/activities?fields=${encodeURIComponent(fields)}&type=TimeEntry&page=${page}&per_page=200`
    );

    const entries = data.data ?? [];
    if (entries.length === 0) break;

    const rows = entries.map((e: Record<string, unknown>) => ({
      clio_id: e.id,
      matter_clio_id: (e.matter as Record<string, unknown>)?.id ?? null,
      matter_description: (e.matter as Record<string, unknown>)?.description ?? null,
      user_name: (e.user as Record<string, unknown>)?.name ?? null,
      date: e.date ?? null,
      quantity_seconds: e.quantity ?? null,
      quantity_hours: e.quantity_in_hours ?? null,
      price: e.price ?? null,
      total: e.total ?? null,
      note: e.note ?? null,
      billable: e.billable ?? true,
      billed: e.billed ?? false,
      activity_description: (e.activity_description as Record<string, unknown>)?.name ?? null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    for (const row of rows) {
      await supabase
        .from('clio_time_entries')
        .upsert(row, { onConflict: 'clio_id' });
    }

    totalSynced += entries.length;

    if (!data.meta?.paging?.next) break;
    page++;
  }

  return totalSynced;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const syncTypes: string[] = body.types ?? ['matters', 'contacts', 'time_entries'];

  const supabase = await createClient();

  let accessToken: string;
  try {
    accessToken = await getValidToken(supabase);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const results: Record<string, { synced: number; error?: string }> = {};

  for (const syncType of syncTypes) {
    const logRow = await supabase
      .from('clio_sync_log')
      .insert({ sync_type: syncType, status: 'running' })
      .select('id')
      .single();

    const logId = logRow.data?.id;

    try {
      let synced = 0;
      if (syncType === 'matters') synced = await syncMatters(accessToken, supabase);
      else if (syncType === 'contacts') synced = await syncContacts(accessToken, supabase);
      else if (syncType === 'time_entries') synced = await syncTimeEntries(accessToken, supabase);

      if (logId) {
        await supabase
          .from('clio_sync_log')
          .update({ status: 'completed', records_synced: synced, completed_at: new Date().toISOString() })
          .eq('id', logId);
      }

      results[syncType] = { synced };
    } catch (err) {
      const msg = (err as Error).message;
      if (logId) {
        await supabase
          .from('clio_sync_log')
          .update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
          .eq('id', logId);
      }
      results[syncType] = { synced: 0, error: msg };
    }
  }

  return NextResponse.json({ results });
}

export async function GET() {
  const supabase = await createClient();

  const [mattersCount, contactsCount, timeCount, recentLogs] = await Promise.all([
    supabase.from('clio_matters').select('id', { count: 'exact', head: true }),
    supabase.from('clio_contacts').select('id', { count: 'exact', head: true }),
    supabase.from('clio_time_entries').select('id', { count: 'exact', head: true }),
    supabase
      .from('clio_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    counts: {
      matters: mattersCount.count ?? 0,
      contacts: contactsCount.count ?? 0,
      time_entries: timeCount.count ?? 0,
    },
    recent_syncs: recentLogs.data ?? [],
  });
}
