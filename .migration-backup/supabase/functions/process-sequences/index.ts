import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-style dispatcher: finds all pending email_sequences whose
// scheduled_at has passed and fires send-nurture-email for each.
//
// Invoke via Supabase cron (pg_cron) or an external scheduler every 15-60 min:
//   SELECT cron.schedule('process-email-sequences', '*/30 * * * *',
//     $SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/process-sequences',
//       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//     )$
//   );

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase credentials not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  // Fetch all pending sequences that are due
  const { data: due, error: fetchError } = await supabase
    .from("email_sequences")
    .select(`
      id,
      inquiry_id,
      sequence_type,
      step_number,
      contact_inquiries (
        name,
        email,
        service,
        source
      )
    `)
    .eq("send_status", "pending")
    .lte("scheduled_at", now)
    .limit(50);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0, message: "No sequences due" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const seq of due) {
    const inquiry = (seq as any).contact_inquiries;
    if (!inquiry?.email || !inquiry?.name) {
      results.push({ id: seq.id, status: "skipped", error: "Missing inquiry data" });
      continue;
    }

    try {
      // Route post_booking_kickoff sequences to the dedicated edge function
      const isPostBooking = seq.sequence_type === "post_booking_kickoff";
      const isPaymentReminder = seq.sequence_type === "payment_reminder";
      const isCalendlyConfirmation = seq.sequence_type === "calendly_booking_confirmation";
      const isProspectFollowup = seq.sequence_type === "prospect_followup";
      const isReviewRequest = seq.sequence_type === "review_request";
      const isPostConsultation = seq.sequence_type === "post_consultation";
      const isContactFollowup = seq.sequence_type === "contact_followup";
      const functionName = isPostBooking
        ? "send-post-booking-email"
        : isPaymentReminder
        ? "send-payment-reminder"
        : isCalendlyConfirmation
        ? "send-calendly-confirmation-email"
        : isProspectFollowup
        ? "send-prospect-followup-email"
        : isReviewRequest
        ? "send-review-request-email"
        : isPostConsultation
        ? "send-post-consultation-email"
        : isContactFollowup
        ? "send-contact-followup-email" :"send-nurture-email";

      const body = isPostBooking
        ? JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
            stepNumber: seq.step_number,
            recipientEmail: inquiry.email,
            recipientName: inquiry.name,
            service: inquiry.service,
          })
        : isPaymentReminder
        ? JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
            reminderType: "invoice_upcoming",
            recipientEmail: inquiry.email,
            recipientName: inquiry.name,
            service: inquiry.service,
          })
        : isCalendlyConfirmation
        ? JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
            stepNumber: seq.step_number,
            recipientEmail: inquiry.email,
            recipientName: inquiry.name,
          })
        : isProspectFollowup
        ? JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
            stepNumber: seq.step_number,
            recipientEmail: inquiry.email,
            recipientName: inquiry.name,
            service: inquiry.service,
          })
        : isReviewRequest
        ? JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
          })
        : isPostConsultation
        ? JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
            stepNumber: seq.step_number,
            recipientEmail: inquiry.email,
            recipientName: inquiry.name,
            service: inquiry.service,
          })
        : isContactFollowup
        ? (() => {
            let meta: any = {};
            try { meta = JSON.parse((seq as any).metadata || "{}"); } catch {}
            return JSON.stringify({
              sequenceId: seq.id,
              inquiryId: seq.inquiry_id,
              stepNumber: seq.step_number,
              recipientEmail: meta.recipientEmail || inquiry.email,
              recipientName: meta.recipientName || inquiry.name,
              service: meta.service || inquiry.service,
              source: meta.source || "contact_form",
            });
          })()
        : JSON.stringify({
            sequenceId: seq.id,
            inquiryId: seq.inquiry_id,
            sequenceType: seq.sequence_type,
            stepNumber: seq.step_number,
            recipientEmail: inquiry.email,
            recipientName: inquiry.name,
            service: inquiry.service,
            source: inquiry.source || "contact_form",
          });

      const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `${functionName} failed`);

      results.push({ id: seq.id, status: "sent" });
    } catch (err: any) {
      results.push({ id: seq.id, status: "failed", error: err.message });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  // ── Process subscriber nurture sequences ──────────────────────────────────
  const { data: dueSubscriber, error: subFetchError } = await supabase
    .from("subscriber_email_sequences")
    .select("id, subscriber_id, subscriber_email, sequence_type, step_number")
    .eq("send_status", "pending")
    .lte("scheduled_at", now)
    .limit(50);

  const subscriberResults: { id: string; status: string; error?: string }[] = [];

  if (!subFetchError && dueSubscriber && dueSubscriber.length > 0) {
    for (const seq of dueSubscriber) {
      if (!seq.subscriber_email) {
        subscriberResults.push({ id: seq.id, status: "skipped", error: "Missing subscriber email" });
        continue;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-subscriber-nurture-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: seq.id,
            subscriberId: seq.subscriber_id,
            subscriberEmail: seq.subscriber_email,
            sequenceType: seq.sequence_type,
            stepNumber: seq.step_number,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "send-subscriber-nurture-email failed");
        subscriberResults.push({ id: seq.id, status: "sent" });
      } catch (err: any) {
        subscriberResults.push({ id: seq.id, status: "failed", error: err.message });
      }
    }
  }

  const subSent = subscriberResults.filter((r) => r.status === "sent").length;
  const subFailed = subscriberResults.filter((r) => r.status === "failed").length;

  // ── Process appointment reminders (24hr and 1hr) ──────────────────────────
  const { data: dueReminders, error: reminderFetchError } = await supabase
    .from("appointment_reminders")
    .select("id, recipient_email, recipient_name, event_name, start_time, meeting_location, reminder_type")
    .eq("send_status", "pending")
    .lte("scheduled_at", now)
    .limit(50);

  const reminderResults: { id: string; status: string; error?: string }[] = [];

  if (!reminderFetchError && dueReminders && dueReminders.length > 0) {
    for (const reminder of dueReminders) {
      if (!reminder.recipient_email) {
        reminderResults.push({ id: reminder.id, status: "skipped", error: "Missing recipient email" });
        continue;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-appointment-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            reminderId: reminder.id,
            recipientEmail: reminder.recipient_email,
            recipientName: reminder.recipient_name,
            eventName: reminder.event_name,
            startTime: reminder.start_time,
            meetingLocation: reminder.meeting_location,
            reminderType: reminder.reminder_type,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "send-appointment-reminder failed");
        reminderResults.push({ id: reminder.id, status: "sent" });
      } catch (err: any) {
        reminderResults.push({ id: reminder.id, status: "failed", error: err.message });
      }
    }
  }

  const reminderSent = reminderResults.filter((r) => r.status === "sent").length;
  const reminderFailed = reminderResults.filter((r) => r.status === "failed").length;

  // ── Process intake nurture sequences ─────────────────────────────────────────
  const { data: dueIntakeNurture, error: intakeNurtureFetchError } = await supabase
    .from("intake_nurture_sequences")
    .select("id, submission_id, recipient_email, recipient_name, case_type, urgency, step_number")
    .eq("send_status", "pending")
    .lte("scheduled_at", now)
    .limit(50);

  const intakeNurtureResults: { id: string; status: string; error?: string }[] = [];

  if (!intakeNurtureFetchError && dueIntakeNurture && dueIntakeNurture.length > 0) {
    for (const seq of dueIntakeNurture) {
      if (!seq.recipient_email) {
        intakeNurtureResults.push({ id: seq.id, status: "skipped", error: "Missing recipient email" });
        continue;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-intake-nurture-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: seq.id,
            submissionId: seq.submission_id,
            stepNumber: seq.step_number,
            recipientEmail: seq.recipient_email,
            recipientName: seq.recipient_name,
            caseType: seq.case_type,
            urgency: seq.urgency,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "send-intake-nurture-email failed");
        intakeNurtureResults.push({ id: seq.id, status: "sent" });
      } catch (err: any) {
        intakeNurtureResults.push({ id: seq.id, status: "failed", error: err.message });
      }
    }
  }

  const intakeNurtureSent = intakeNurtureResults.filter((r) => r.status === "sent").length;
  const intakeNurtureFailed = intakeNurtureResults.filter((r) => r.status === "failed").length;

  // ── Process consultation 24-hour reminders ────────────────────────────────
  const { data: dueConsultationReminders, error: consultReminderFetchError } = await supabase
    .from("consultation_reminder_logs")
    .select("id, booking_id, recipient_email, recipient_name, booking_date, booking_time, duration_minutes, meeting_link")
    .eq("send_status", "pending")
    .lte("scheduled_at", now)
    .limit(50);

  const consultReminderResults: { id: string; status: string; error?: string }[] = [];

  if (!consultReminderFetchError && dueConsultationReminders && dueConsultationReminders.length > 0) {
    for (const reminder of dueConsultationReminders) {
      if (!reminder.recipient_email) {
        consultReminderResults.push({ id: reminder.id, status: "skipped", error: "Missing recipient email" });
        continue;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-consultation-24hr-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            bookingId: reminder.booking_id,
            clientEmail: reminder.recipient_email,
            clientName: reminder.recipient_name,
            bookingDate: reminder.booking_date,
            bookingTime: reminder.booking_time,
            durationMinutes: reminder.duration_minutes,
            meetingLink: reminder.meeting_link,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "send-consultation-24hr-reminder failed");

        // Mark as sent
        await supabase
          .from("consultation_reminder_logs")
          .update({ send_status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        consultReminderResults.push({ id: reminder.id, status: "sent" });
      } catch (err: any) {
        await supabase
          .from("consultation_reminder_logs")
          .update({ send_status: "failed" })
          .eq("id", reminder.id);
        consultReminderResults.push({ id: reminder.id, status: "failed", error: err.message });
      }
    }
  }

  const consultReminderSent = consultReminderResults.filter((r) => r.status === "sent").length;
  const consultReminderFailed = consultReminderResults.filter((r) => r.status === "failed").length;

  return new Response(
    JSON.stringify({
      success: true,
      contact_sequences: { processed: due.length, sent, failed, results },
      subscriber_sequences: {
        processed: dueSubscriber?.length ?? 0,
        sent: subSent,
        failed: subFailed,
        results: subscriberResults,
      },
      appointment_reminders: {
        processed: dueReminders?.length ?? 0,
        sent: reminderSent,
        failed: reminderFailed,
        results: reminderResults,
      },
      intake_nurture_sequences: {
        processed: dueIntakeNurture?.length ?? 0,
        sent: intakeNurtureSent,
        failed: intakeNurtureFailed,
        results: intakeNurtureResults,
      },
      consultation_24hr_reminders: {
        processed: dueConsultationReminders?.length ?? 0,
        sent: consultReminderSent,
        failed: consultReminderFailed,
        results: consultReminderResults,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
