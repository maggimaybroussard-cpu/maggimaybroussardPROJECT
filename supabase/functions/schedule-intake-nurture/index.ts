import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * schedule-intake-nurture
 *
 * Called immediately after an intake form submission is saved.
 * Schedules a multi-step nurture sequence designed to build trust
 * and drive conversions for prospects who have already booked a consultation.
 *
 * Sequence:
 *   Step 1 — Immediate (0h)   : Intake confirmation + what to expect
 *   Step 2 — Day 1   (24h)   : Case preparation tips + value-add content
 *   Step 3 — Day 3   (72h)   : Social proof / case study relevant to their case type
 *   Step 4 — Day 7   (168h)  : Consultation prep checklist + reminder
 *   Step 5 — Day 14  (336h)  : Post-consultation follow-up / re-engagement
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const {
      submissionId,
      inquiryId,
      recipientEmail,
      recipientName,
      caseType,
      urgency,
    } = await req.json();

    if (!submissionId || !recipientEmail || !recipientName) {
      throw new Error("submissionId, recipientEmail, and recipientName are required");
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Define the 5-step sequence schedule
    const schedule = [
      {
        step_number: 1,
        step_label: "Intake Confirmation",
        delay_hours: 0,
      },
      {
        step_number: 2,
        step_label: "Case Preparation Tips",
        delay_hours: 24,
      },
      {
        step_number: 3,
        step_label: "Social Proof & Case Studies",
        delay_hours: 72,
      },
      {
        step_number: 4,
        step_label: "Consultation Prep Checklist",
        delay_hours: 168,
      },
      {
        step_number: 5,
        step_label: "Post-Consultation Follow-Up",
        delay_hours: 336,
      },
    ];

    const rows = schedule.map(({ step_number, step_label, delay_hours }) => {
      const scheduledAt = new Date(now.getTime() + delay_hours * 60 * 60 * 1000);
      return {
        submission_id: submissionId,
        inquiry_id: inquiryId ?? null,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        case_type: caseType ?? "General Legal Support",
        urgency: urgency ?? "standard",
        sequence_type: "intake_nurture",
        step_number,
        step_label,
        scheduled_at: scheduledAt.toISOString(),
        send_status: "pending",
      };
    });

    const { data: inserted, error } = await supabase
      .from("intake_nurture_sequences")
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);

    // Fire Step 1 immediately (delay_hours = 0)
    const step1 = inserted?.find((r: any) => r.step_number === 1);
    if (step1) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-intake-nurture-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: step1.id,
            submissionId,
            stepNumber: 1,
            recipientEmail,
            recipientName,
            caseType: caseType ?? "General Legal Support",
            urgency: urgency ?? "standard",
          }),
        });
      } catch {
        // Non-blocking — confirmation email failure should not abort scheduling
      }
    }

    return new Response(
      JSON.stringify({ success: true, scheduled: inserted?.length ?? 0 }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
