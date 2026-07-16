import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Schedules the 3-step post-payment email sequence for a client who has
 * just completed a payment.
 *
 * Step 1 — Immediate (0h):   Welcome + Next Steps
 * Step 2 — Day 1   (24h):   Documentation Request
 * Step 3 — Day 3   (72h):   Engagement Expectations
 *
 * Called by confirm-payment after a successful Stripe payment.
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
      inquiryId,
      recipientEmail,
      recipientName,
      service,
      amount,
      paymentType,
      referenceCode,
      paymentIntentId,
      consultationDate,
      paymentDate,
    } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    if (!recipientEmail) {
      throw new Error("recipientEmail is required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Define the 3-step post-payment sequence
    const schedule = [
      { step_number: 1, delay_hours: 0,  label: "Welcome + Next Steps (Immediate)" },
      { step_number: 2, delay_hours: 24, label: "Documentation Request (Day 1)" },
      { step_number: 3, delay_hours: 72, label: "Engagement Expectations (Day 3)" },
    ];

    const rows = schedule.map(({ step_number, delay_hours }) => {
      const scheduledAt = new Date(now.getTime() + delay_hours * 60 * 60 * 1000);
      return {
        inquiry_id: inquiryId ?? null,
        sequence_type: "post_payment_welcome",
        step_number,
        scheduled_at: scheduledAt.toISOString(),
        send_status: "pending",
      };
    });

    const { data: inserted, error } = await supabase
      .from("email_sequences")
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);

    // Fire Step 1 (welcome email) immediately
    const step1Row = inserted?.find((r: any) => r.step_number === 1);
    if (step1Row) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-post-payment-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: step1Row.id,
            stepNumber: 1,
            recipientEmail,
            recipientName: recipientName ?? "Valued Client",
            service: service ?? "Legal Services",
            amount: amount ?? 0,
            paymentType: paymentType ?? "consultation_deposit",
            referenceCode: referenceCode ?? paymentIntentId ?? "N/A",
            consultationDate: consultationDate ?? null,
            paymentDate: paymentDate ?? null,
          }),
        });
      } catch (sendErr) {
        // Non-blocking — scheduling succeeded even if immediate send fails
        console.error("Step 1 immediate send error:", sendErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: inserted?.length ?? 0,
        steps: schedule.map((s) => s.label),
      }),
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
