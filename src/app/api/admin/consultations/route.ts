import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  sendConsultationAlertEmail,
  type ConsultationAlertType,
} from '@/lib/email/consultationAlertEmails';

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Statuses that trigger client alert emails
const ALERT_STATUS_MAP: Record<string, ConsultationAlertType> = {
  confirmed: 'confirmed',
  completed: 'completed',
};

function formatBookingDate(startTime: string | null | undefined): string {
  if (!startTime) return 'TBD';
  try {
    return new Date(startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Chicago',
    });
  } catch {
    return startTime;
  }
}

function formatBookingTime(startTime: string | null | undefined): string {
  if (!startTime) return 'TBD';
  try {
    return new Date(startTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short',
    });
  } catch {
    return startTime;
  }
}

// GET — list all booked consultations (contact_inquiries with calendly booking)
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let query = supabase
      .from('contact_inquiries')
      .select('id, name, firm, email, service, status, notes, created_at, updated_at, calendly_event_uuid, calendly_invitee_uuid, calendly_start_time, calendly_end_time, calendly_event_name, calendly_meeting_location, booking_stage')
      .not('calendly_event_uuid', 'is', null)
      .order('calendly_start_time', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,firm.ilike.%${search}%,service.ilike.%${search}%`);
    }
    if (dateFrom) {
      query = query.gte('calendly_start_time', dateFrom);
    }
    if (dateTo) {
      query = query.lte('calendly_start_time', dateTo + 'T23:59:59Z');
    }

    const { data, error } = await query;
    if (error) throw error;

    const consultations = data || [];
    const now = new Date();
    const upcoming = consultations.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) > now).length;
    const past = consultations.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) <= now).length;

    return NextResponse.json({ consultations, stats: { total: consultations.length, upcoming, past } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch consultations' }, { status: 500 });
  }
}

// PATCH — update a consultation (reschedule date/time, status, notes)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();
    const { id, previousStatus, ...updates } = body as {
      id: string;
      previousStatus?: string;
      status?: string;
      notes?: string;
      calendly_start_time?: string;
      calendly_end_time?: string;
      booking_stage?: string;
    };

    if (!id) {
      return NextResponse.json({ error: 'Missing consultation id' }, { status: 400 });
    }

    // Only allow safe fields to be updated
    const allowedFields: Record<string, unknown> = {};
    if (updates.status !== undefined) allowedFields.status = updates.status;
    if (updates.notes !== undefined) allowedFields.notes = updates.notes;
    if (updates.calendly_start_time !== undefined) allowedFields.calendly_start_time = updates.calendly_start_time;
    if (updates.calendly_end_time !== undefined) allowedFields.calendly_end_time = updates.calendly_end_time;
    if (updates.booking_stage !== undefined) allowedFields.booking_stage = updates.booking_stage;

    const { data, error } = await supabase
      .from('contact_inquiries')
      .update({ ...allowedFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // ── Trigger consultation alert if status changed ────────────────────────
    const newStatus = updates.status;
    const isRescheduled =
      updates.calendly_start_time !== undefined &&
      updates.calendly_start_time !== data?.calendly_start_time;

    let alertType: ConsultationAlertType | null = null;

    if (isRescheduled) {
      alertType = 'rescheduled';
    } else if (newStatus && newStatus !== previousStatus && ALERT_STATUS_MAP[newStatus]) {
      alertType = ALERT_STATUS_MAP[newStatus];
    }

    let alertResult: { emailSent: boolean; notificationInserted: boolean } | null = null;

    if (alertType && data?.email && data?.name) {
      const startTime = updates.calendly_start_time ?? data.calendly_start_time;
      const resendApiKey = process.env.RESEND_API_KEY ?? '';
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

      // Send email
      const emailResult = await sendConsultationAlertEmail({
        resendApiKey,
        clientEmail: data.email,
        clientName: data.name,
        alertType,
        bookingDate: formatBookingDate(startTime),
        bookingTime: formatBookingTime(startTime),
        bookingType: data.calendly_event_name ?? data.service ?? 'Consultation',
        meetingLocation: data.calendly_meeting_location ?? undefined,
        notes: updates.notes ?? data.notes ?? undefined,
        portalLink: `${siteUrl}/portal/dashboard`,
      });

      // Insert in-app notifications
      const notifTitle =
        alertType === 'confirmed' ? 'Consultation Confirmed' :
        alertType === 'rescheduled'? 'Consultation Rescheduled' : 'Consultation Completed';

      const notifBody =
        alertType === 'completed'
          ? 'Thank you for your consultation. We look forward to assisting you further.'
          : `Your consultation is ${alertType === 'rescheduled' ? 'rescheduled to' : 'confirmed for'} ${formatBookingDate(startTime)} at ${formatBookingTime(startTime)}.`;

      await supabase.from('notifications').insert([
        {
          audience: 'admin',
          user_id: null,
          inquiry_id: id,
          notification_type: 'system',
          title: `${notifTitle} — ${data.name}`,
          body: `${notifBody} Email ${emailResult.sent ? 'sent' : 'failed'}.`,
          link: '/admin?tab=consultations',
          metadata: { alert_type: alertType, client_email: data.email, email_sent: emailResult.sent },
        },
      ]);

      alertResult = { emailSent: emailResult.sent, notificationInserted: true };
    }

    // ── Trigger post-consultation email sequence when marked completed ──────
    let postConsultationSequenceTriggered = false;
    if (
      updates.status === 'completed' &&
      previousStatus !== 'completed' &&
      data?.email &&
      data?.name
    ) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
        if (supabaseUrl && serviceRoleKey) {
          const seqRes = await fetch(
            `${supabaseUrl}/functions/v1/schedule-post-consultation-sequence`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                inquiryId: id,
                recipientEmail: data.email,
                recipientName: data.name,
                service: data.service ?? 'legal support',
              }),
            }
          );
          if (seqRes.ok) {
            postConsultationSequenceTriggered = true;
            // Log the trigger
            await supabase.from('post_consultation_sequence_logs').insert({
              inquiry_id: id,
              triggered_by: 'admin_status_change',
              client_email: data.email,
              client_name: data.name,
              service: data.service ?? null,
              steps_scheduled: 3,
            });
          }
        }
      } catch {
        // Non-blocking — sequence failure should not fail the status update
      }

      // Also trigger onboarding post-consultation follow-up email
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
        if (supabaseUrl && serviceRoleKey) {
          await fetch(`${supabaseUrl}/functions/v1/schedule-onboarding-sequence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              trigger: 'completed',
              inquiryId: id,
              clientEmail: data.email,
              clientName: data.name,
              service: data.service ?? 'Legal Services',
            }),
          });
        }
      } catch {
        // Non-blocking
      }
    }

    // ── Trigger onboarding sequence when status changes to "confirmed" ──────
    if (
      updates.status === 'confirmed' &&
      previousStatus !== 'confirmed' &&
      data?.email &&
      data?.name
    ) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
        if (supabaseUrl && serviceRoleKey) {
          const startTime = updates.calendly_start_time ?? data.calendly_start_time;
          let bookingDate: string | undefined;
          let bookingTime: string | undefined;
          if (startTime) {
            try {
              const dt = new Date(startTime);
              bookingDate = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
              bookingTime = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/Chicago' });
            } catch { /* leave undefined */ }
          }
          await fetch(`${supabaseUrl}/functions/v1/schedule-onboarding-sequence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              trigger: 'confirmed',
              inquiryId: id,
              clientEmail: data.email,
              clientName: data.name,
              service: data.service ?? 'Legal Services',
              bookingDate,
              bookingTime,
              meetingLocation: data.calendly_meeting_location ?? undefined,
            }),
          });
        }
      } catch {
        // Non-blocking
      }
    }

    // ── Trigger onboarding no-show follow-up when status changes to "closed" after past booking ──────
    if (
      updates.status === 'closed' &&
      previousStatus !== 'closed' &&
      data?.email &&
      data?.name &&
      data?.calendly_start_time &&
      new Date(data.calendly_start_time) < new Date()
    ) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
        if (supabaseUrl && serviceRoleKey) {
          await fetch(`${supabaseUrl}/functions/v1/schedule-onboarding-sequence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              trigger: 'no_show',
              inquiryId: id,
              clientEmail: data.email,
              clientName: data.name,
              service: data.service ?? 'Legal Services',
            }),
          });
        }
      } catch {
        // Non-blocking
      }
    }

    // ── Auto-create action items when consultation is marked completed ──────
    let actionItemsCreated = 0;
    if (updates.status === 'completed' && previousStatus !== 'completed') {
      try {
        const service = (data?.service ?? '').toLowerCase();
        const clientName = data?.name ?? 'Client';
        const dueIn3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const dueIn7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const dueIn14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        // Base action items for every completed consultation
        const baseItems = [
          {
            inquiry_id: id,
            title: `Send engagement form to ${clientName}`,
            description: 'Send the standard engagement/retainer agreement for client signature.',
            task_type: 'engagement_form',
            priority: 'high',
            due_date: dueIn3Days,
            visible_to_client: true,
          },
          {
            inquiry_id: id,
            title: `Schedule retainer onboarding call with ${clientName}`,
            description: 'Book a 30-minute onboarding call to review retainer terms and next steps.',
            task_type: 'retainer_call',
            priority: 'high',
            due_date: dueIn7Days,
            visible_to_client: true,
          },
        ];

        // Service-specific action items
        const serviceItems: Array<{
          inquiry_id: string;
          title: string;
          description: string;
          task_type: string;
          priority: string;
          due_date: string;
          visible_to_client: boolean;
        }> = [];

        if (service.includes('business') || service.includes('formation') || service.includes('llc') || service.includes('corporation')) {
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Prepare business formation documents for ${clientName}`,
              description: 'Draft articles of incorporation/organization, operating agreement, and initial resolutions.',
              task_type: 'document_preparation',
              priority: 'medium',
              due_date: dueIn14Days,
              visible_to_client: false,
            },
            {
              inquiry_id: id,
              title: `Send business intake questionnaire to ${clientName}`,
              description: 'Collect business name, ownership structure, registered agent, and EIN details.',
              task_type: 'intake_questionnaire',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            }
          );
        } else if (service.includes('contract') || service.includes('agreement') || service.includes('review')) {
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Request contract documents from ${clientName}`,
              description: 'Ask client to upload all relevant contracts and agreements for review.',
              task_type: 'document_request',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            },
            {
              inquiry_id: id,
              title: `Complete contract review and redline for ${clientName}`,
              description: 'Review, annotate, and prepare redlined version of client contracts.',
              task_type: 'legal_review',
              priority: 'medium',
              due_date: dueIn14Days,
              visible_to_client: false,
            }
          );
        } else if (service.includes('employment') || service.includes('hr') || service.includes('workplace')) {
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Send employment law intake form to ${clientName}`,
              description: 'Collect details on employment situation, timeline, and relevant documentation.',
              task_type: 'intake_questionnaire',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            },
            {
              inquiry_id: id,
              title: `Review employment documents for ${clientName}`,
              description: 'Analyze employment contracts, offer letters, termination notices, and HR policies.',
              task_type: 'legal_review',
              priority: 'medium',
              due_date: dueIn14Days,
              visible_to_client: false,
            }
          );
        } else if (service.includes('real estate') || service.includes('property') || service.includes('lease')) {
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Request property documents from ${clientName}`,
              description: 'Collect purchase agreement, title report, inspection reports, and HOA documents.',
              task_type: 'document_request',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            },
            {
              inquiry_id: id,
              title: `Prepare real estate closing checklist for ${clientName}`,
              description: 'Create comprehensive closing checklist and timeline for the transaction.',
              task_type: 'document_preparation',
              priority: 'medium',
              due_date: dueIn7Days,
              visible_to_client: true,
            }
          );
        } else if (service.includes('estate') || service.includes('trust') || service.includes('will') || service.includes('probate')) {
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Send estate planning questionnaire to ${clientName}`,
              description: 'Collect asset inventory, beneficiary information, and estate planning goals.',
              task_type: 'intake_questionnaire',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            },
            {
              inquiry_id: id,
              title: `Draft estate planning documents for ${clientName}`,
              description: 'Prepare will, trust documents, power of attorney, and healthcare directive.',
              task_type: 'document_preparation',
              priority: 'medium',
              due_date: dueIn14Days,
              visible_to_client: false,
            }
          );
        } else if (service.includes('ip') || service.includes('intellectual') || service.includes('trademark') || service.includes('copyright') || service.includes('patent')) {
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Conduct IP search and clearance for ${clientName}`,
              description: 'Perform trademark/copyright search and prepare clearance report.',
              task_type: 'legal_review',
              priority: 'high',
              due_date: dueIn7Days,
              visible_to_client: false,
            },
            {
              inquiry_id: id,
              title: `Send IP intake form to ${clientName}`,
              description: 'Collect details on IP assets, use cases, and registration goals.',
              task_type: 'intake_questionnaire',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            }
          );
        } else {
          // Generic legal service items
          serviceItems.push(
            {
              inquiry_id: id,
              title: `Send legal intake questionnaire to ${clientName}`,
              description: 'Collect detailed information about the legal matter and client objectives.',
              task_type: 'intake_questionnaire',
              priority: 'high',
              due_date: dueIn3Days,
              visible_to_client: true,
            }
          );
        }

        const allItems = [...baseItems, ...serviceItems];
        const { error: itemsError } = await supabase
          .from('consultation_action_items')
          .insert(allItems);

        if (!itemsError) {
          actionItemsCreated = allItems.length;
        }
      } catch {
        // Non-blocking
      }
    }

    // ── Auto-create retainer case when consultation is marked completed ──────
    let retainerCaseCreated: { id: string; caseNumber: string } | null = null;
    if (updates.status === 'completed' && previousStatus !== 'completed' && data) {
      try {
        // Check if a retainer case already exists for this inquiry
        const { data: existingCase } = await supabase
          .from('retainer_cases')
          .select('id, case_number')
          .eq('inquiry_id', id)
          .maybeSingle();

        if (!existingCase) {
          // Generate a sequential case number
          const { data: seqRow } = await supabase
            .rpc('nextval', { seq: 'retainer_case_number_seq' })
            .single()
            .catch(() => ({ data: null }));

          const caseNumber = `RC-${new Date().getFullYear()}-${String(seqRow ?? Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`;

          // Derive a human-readable title from service type
          const serviceRaw = data.service ?? 'Legal Services';
          const caseTitle = `${serviceRaw} — ${data.name ?? 'Client'}`;

          // Look up any existing engagement for this inquiry
          const { data: engagement } = await supabase
            .from('engagements')
            .select('id, retainer_tier, retainer_amount')
            .eq('inquiry_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: newCase, error: caseError } = await supabase
            .from('retainer_cases')
            .insert({
              inquiry_id: id,
              case_number: caseNumber,
              title: caseTitle,
              service_type: data.service ?? null,
              status: 'active',
              client_name: data.name ?? null,
              client_email: data.email ?? null,
              client_firm: data.firm ?? null,
              retainer_tier: engagement?.retainer_tier ?? 'standard',
              retainer_amount: engagement?.retainer_amount ?? null,
              engagement_id: engagement?.id ?? null,
              consultation_date: data.calendly_start_time ?? null,
              opened_at: new Date().toISOString(),
              notes: data.notes ?? null,
              created_by: 'system',
              metadata: {
                auto_created: true,
                consultation_id: id,
                action_items_count: actionItemsCreated,
                deliverable_hub_path: `/client-deliverable-hub`,
                action_items_timeline_path: `/admin?tab=consultations`,
              },
            })
            .select('id, case_number')
            .single();

          if (!caseError && newCase) {
            retainerCaseCreated = { id: newCase.id, caseNumber: newCase.case_number };

            // Insert admin notification for the new retainer case
            await supabase.from('notifications').insert([
              {
                audience: 'admin',
                user_id: null,
                inquiry_id: id,
                notification_type: 'system',
                title: `Retainer Case Created — ${data.name}`,
                body: `Case ${newCase.case_number} opened for ${data.name} (${data.service ?? 'Legal Services'}). Linked to deliverable hub and action items timeline.`,
                link: '/admin?tab=consultations',
                metadata: {
                  retainer_case_id: newCase.id,
                  case_number: newCase.case_number,
                  inquiry_id: id,
                  client_email: data.email,
                },
              },
            ]);
          }
        } else {
          retainerCaseCreated = { id: existingCase.id, caseNumber: existingCase.case_number };
        }
      } catch {
        // Non-blocking — retainer case failure should not fail the status update
      }
    }

    return NextResponse.json({ consultation: data, alert: alertResult, postConsultationSequenceTriggered, actionItemsCreated, retainerCaseCreated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update consultation' }, { status: 500 });
  }
}
