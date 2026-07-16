import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// ── Tier hours map (mirrors stripe-subscription-webhook logic) ────────────────
function getTierHours(planName: string, amount: number): number {
  const nameLower = (planName ?? "").toLowerCase();
  if (nameLower.includes("essential") || amount <= 750) return 5;
  if (nameLower.includes("standard") || (amount > 750 && amount <= 1500)) return 10;
  if (nameLower.includes("premium") || (amount > 1500 && amount <= 2500)) return 20;
  if (nameLower.includes("enterprise") || amount > 2500) return 40;
  return 10; // default
}

// ── Depletion thresholds ──────────────────────────────────────────────────────
// Alert when hours used >= 75% (warning) or >= 90% (critical)
const WARNING_THRESHOLD = 0.75;
const CRITICAL_THRESHOLD = 0.90;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional body — can pass a specific subscriptionId to check one, or leave empty to check all active
    let targetSubscriptionId: string | null = null;
    try {
      const body = await req.json();
      targetSubscriptionId = body?.subscriptionId ?? null;
    } catch {
      // no body — check all active subscriptions
    }

    // 1. Fetch active retainer subscriptions
    let query = supabase
      .from("retainer_subscriptions")
      .select("id, customer_name, customer_email, plan_name, amount, current_period_start, current_period_end, status")
      .eq("status", "active");

    if (targetSubscriptionId) {
      query = query.eq("id", targetSubscriptionId);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, alerts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alerts: Array<{
      subscriptionId: string;
      customerEmail: string;
      hoursUsed: number;
      hoursTotal: number;
      percentUsed: number;
      alertLevel: "warning" | "critical";
      emailSent: boolean;
    }> = [];

    for (const sub of subscriptions) {
      const hoursTotal = getTierHours(sub.plan_name, Number(sub.amount));

      // 2. Count hours used this billing period from retainer_time_logs (if table exists)
      // Fall back to checking case notes / activity logs for hour tracking
      // Primary: look for a retainer_time_logs table; if not present, use metadata on the subscription
      let hoursUsed = 0;

      // Try retainer_time_logs table first
      const { data: timeLogs, error: timeLogError } = await supabase
        .from("retainer_time_logs")
        .select("hours")
        .eq("retainer_subscription_id", sub.id)
        .gte("logged_at", sub.current_period_start ?? new Date(0).toISOString())
        .lte("logged_at", sub.current_period_end ?? new Date().toISOString());

      if (!timeLogError && timeLogs) {
        hoursUsed = timeLogs.reduce((sum: number, log: { hours: number }) => sum + Number(log.hours ?? 0), 0);
      } else {
        // Fallback: check metadata.hours_used on the subscription record
        const { data: subMeta } = await supabase
          .from("retainer_subscriptions")
          .select("metadata")
          .eq("id", sub.id)
          .single();

        hoursUsed = Number(subMeta?.metadata?.hours_used ?? 0);
      }

      const percentUsed = hoursTotal > 0 ? hoursUsed / hoursTotal : 0;

      // 3. Determine if alert threshold is crossed
      const isWarning = percentUsed >= WARNING_THRESHOLD && percentUsed < CRITICAL_THRESHOLD;
      const isCritical = percentUsed >= CRITICAL_THRESHOLD;

      if (!isWarning && !isCritical) continue;

      const alertLevel = isCritical ? "critical" : "warning";

      // 4. Check if we already sent an alert at this level this period to avoid spam
      const alertKey = `hours_alert_${alertLevel}_${sub.current_period_start?.slice(0, 7) ?? ""}`;
      const { data: subRecord } = await supabase
        .from("retainer_subscriptions")
        .select("metadata")
        .eq("id", sub.id)
        .single();

      const alreadySent = subRecord?.metadata?.[alertKey] === true;
      if (alreadySent) continue;

      // 5. Send depletion alert email via notify-client
      let emailSent = false;
      try {
        const notifyRes = await fetch(`${SUPABASE_URL}/functions/v1/notify-client`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            clientEmail: sub.customer_email,
            clientName: sub.customer_name,
            eventType: "hours_depletion",
            details: {
              planName: sub.plan_name,
              hoursUsed,
              hoursTotal,
              percentUsed: Math.round(percentUsed * 100),
              hoursRemaining: Math.max(0, hoursTotal - hoursUsed),
              alertLevel,
              periodEnd: sub.current_period_end,
            },
          }),
        });
        emailSent = notifyRes.ok;
      } catch (emailErr) {
        console.error(`Hours depletion email error for ${sub.customer_email}:`, emailErr);
      }

      // 6. Mark alert as sent in metadata to prevent duplicate emails
      if (emailSent) {
        const currentMeta = subRecord?.metadata ?? {};
        await supabase
          .from("retainer_subscriptions")
          .update({
            metadata: { ...currentMeta, [alertKey]: true },
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }

      alerts.push({
        subscriptionId: sub.id,
        customerEmail: sub.customer_email,
        hoursUsed,
        hoursTotal,
        percentUsed: Math.round(percentUsed * 100),
        alertLevel,
        emailSent,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: subscriptions.length,
        alerts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-retainer-hours error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
