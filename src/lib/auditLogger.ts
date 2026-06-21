import { createClient } from '@/lib/supabase/client';

export type AuditActionType =
  | 'user_login' | 'user_logout' |'document_upload' | 'document_delete' | 'document_download'
  | 'invoice_sent'| 'invoice_created' | 'invoice_updated' |'case_created'| 'case_updated' | 'case_status_changed' | 'case_stage_changed' | 'case_note_added' |'client_invited'| 'client_email_sent' |'task_created' | 'task_updated' | 'task_completed'
  | 'template_created' | 'template_updated' | 'template_deleted' | 'email_template_updated'
  | 'retainer_created'| 'retainer_updated' | 'retainer_renewed' | 'retainer_cancelled' |'payment_recorded'| 'payment_failed' |'message_sent' |'signature_requested' | 'signature_completed'
  | 'data_export' |'intake_submitted' |'appointment_booked' |'stripe_invoice_synced' |'admin_action' |'permission_changed' | 'role_changed';

export interface AuditLogEntry {
  action_type: AuditActionType;
  actor_email: string;
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  target_label?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

/**
 * Log an admin action to the audit trail.
 * Non-blocking — errors are silently swallowed so they never break the main flow.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('audit_logs').insert({
      action_type: entry.action_type,
      actor_email: entry.actor_email,
      actor_id: entry.actor_id ?? null,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      target_label: entry.target_label ?? null,
      description: entry.description,
      metadata: entry.metadata ?? {},
      ip_address: entry.ip_address ?? null,
    });
  } catch {
    // Non-blocking — audit failures must never break the main action
  }
}

/**
 * Log a compliance data export event.
 */
export async function logComplianceExport(params: {
  actorEmail: string;
  actorId?: string;
  format: string;
  dateFrom?: string;
  dateTo?: string;
  actionFilter?: string;
  totalRecords: number;
}): Promise<void> {
  try {
    const supabase = createClient();
    // Log to compliance_export_logs
    await supabase.from('compliance_export_logs').insert({
      exported_by_email: params.actorEmail,
      exported_by_id: params.actorId ?? null,
      export_format: params.format,
      date_from: params.dateFrom ? new Date(params.dateFrom).toISOString() : null,
      date_to: params.dateTo ? new Date(params.dateTo).toISOString() : null,
      action_filter: params.actionFilter ?? null,
      total_records: params.totalRecords,
    });
    // Also log to audit trail
    await logAuditEvent({
      action_type: 'data_export',
      actor_email: params.actorEmail,
      actor_id: params.actorId,
      target_type: 'compliance_export',
      description: `Compliance data export: ${params.totalRecords} records exported as ${params.format.toUpperCase()}`,
      metadata: {
        format: params.format,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        action_filter: params.actionFilter,
        total_records: params.totalRecords,
      },
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Get the current admin's email from the Supabase session. * Returns'admin' as fallback.
 */
export async function getAdminEmail(): Promise<{ email: string; id: string | undefined }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { email: user?.email ?? 'admin', id: user?.id };
  } catch {
    return { email: 'admin', id: undefined };
  }
}
