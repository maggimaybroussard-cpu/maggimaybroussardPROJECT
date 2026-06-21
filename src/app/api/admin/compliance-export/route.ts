import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logComplianceExport } from '@/lib/auditLogger';

const ACTION_LABELS: Record<string, string> = {
  user_login: 'User Login',
  user_logout: 'User Logout',
  document_upload: 'Document Upload',
  document_delete: 'Document Delete',
  document_download: 'Document Download',
  invoice_sent: 'Invoice Sent',
  invoice_created: 'Invoice Created',
  invoice_updated: 'Invoice Updated',
  case_created: 'Case Created',
  case_updated: 'Case Updated',
  case_status_changed: 'Case Status Changed',
  case_stage_changed: 'Case Stage Changed',
  case_note_added: 'Case Note Added',
  client_invited: 'Client Invited',
  client_email_sent: 'Client Email Sent',
  task_created: 'Task Created',
  task_updated: 'Task Updated',
  task_completed: 'Task Completed',
  template_created: 'Template Created',
  template_updated: 'Template Updated',
  template_deleted: 'Template Deleted',
  email_template_updated: 'Email Template Updated',
  retainer_created: 'Retainer Created',
  retainer_updated: 'Retainer Updated',
  retainer_renewed: 'Retainer Renewed',
  retainer_cancelled: 'Retainer Cancelled',
  payment_recorded: 'Payment Recorded',
  payment_failed: 'Payment Failed',
  message_sent: 'Message Sent',
  signature_requested: 'Signature Requested',
  signature_completed: 'Signature Completed',
  data_export: 'Data Export',
  intake_submitted: 'Intake Submitted',
  appointment_booked: 'Appointment Booked',
  stripe_invoice_synced: 'Stripe Invoice Synced',
  admin_action: 'Admin Action',
  permission_changed: 'Permission Changed',
  role_changed: 'Role Changed',
};

function escapeCSV(value: unknown): string {
  const s = String(value ?? '').replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'csv'; // csv | json
    const dateFrom = searchParams.get('date_from') ?? '';
    const dateTo = searchParams.get('date_to') ?? '';
    const actionFilter = searchParams.get('action_type') ?? '';
    const actorFilter = searchParams.get('actor_email') ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10000'), 50000);

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('id, action_type, actor_email, actor_id, target_type, target_id, target_label, description, metadata, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionFilter) {
      query = query.eq('action_type', actionFilter);
    }
    if (actorFilter) {
      query = query.ilike('actor_email', `%${actorFilter}%`);
    }
    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }

    const { data: logs, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const records = logs ?? [];

    // Log the export event (non-blocking)
    logComplianceExport({
      actorEmail: user.email ?? 'admin',
      actorId: user.id,
      format,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      actionFilter: actionFilter || undefined,
      totalRecords: records.length,
    }).catch(() => {});

    if (format === 'json') {
      const exportData = {
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        filters: { date_from: dateFrom || null, date_to: dateTo || null, action_type: actionFilter || null, actor_email: actorFilter || null },
        total_records: records.length,
        records: records.map(log => ({
          id: log.id,
          timestamp: log.created_at,
          action_type: log.action_type,
          action_label: ACTION_LABELS[log.action_type] ?? log.action_type,
          actor_email: log.actor_email,
          actor_id: log.actor_id,
          target_type: log.target_type,
          target_id: log.target_id,
          target_label: log.target_label,
          description: log.description,
          ip_address: log.ip_address,
          metadata: log.metadata,
        })),
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="compliance-audit-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // CSV format
    const headers = [
      'Event ID',
      'Timestamp (UTC)',
      'Action Type',
      'Action Label',
      'Actor Email',
      'Actor ID',
      'Target Type',
      'Target ID',
      'Target Label',
      'Description',
      'IP Address',
      'Metadata',
    ];

    const rows = records.map(log => [
      log.id,
      formatDateTime(log.created_at),
      log.action_type,
      ACTION_LABELS[log.action_type] ?? log.action_type,
      log.actor_email,
      log.actor_id ?? '',
      log.target_type ?? '',
      log.target_id ?? '',
      log.target_label ?? '',
      log.description,
      log.ip_address ?? '',
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);

    const csvContent = [
      `# Compliance Audit Export`,
      `# Exported: ${new Date().toISOString()}`,
      `# Exported By: ${user.email}`,
      `# Total Records: ${records.length}`,
      `# Filters: date_from=${dateFrom || 'none'} date_to=${dateTo || 'none'} action_type=${actionFilter || 'all'} actor=${actorFilter || 'all'}`,
      '',
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(',')),
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="compliance-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    console.error('[compliance-export]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
