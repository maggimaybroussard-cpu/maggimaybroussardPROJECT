import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// GET — fetch active overdue invoice alerts
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const includeDismissed = searchParams.get("include_dismissed") === "true";

    let query = supabase
      .from("overdue_invoice_alerts")
      .select(`
        id,
        invoice_id,
        inquiry_id,
        client_name,
        client_email,
        invoice_number,
        amount_due,
        due_date,
        days_overdue,
        reminder_sent_at,
        reminder_status,
        sms_sent,
        tier_label,
        dismissed,
        dismissed_at,
        created_at
      `)
      .order("days_overdue", { ascending: false });

    if (!includeDismissed) {
      query = query.eq("dismissed", false);
    }

    const { data: alerts, error } = await query;
    if (error) throw error;

    // Compute live count of overdue invoices at each tier threshold
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const { count: totalOverdue } = await supabase
      .from("client_invoices")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "overdue"])
      .lte("due_date", fifteenDaysAgo.toISOString().split("T")[0]);

    const activeAlerts = (alerts ?? []).filter((a) => !a.dismissed);

    // Tier breakdown counts
    const tierCounts = {
      early: activeAlerts.filter((a) => a.tier_label === "early").length,
      overdue: activeAlerts.filter((a) => a.tier_label === "overdue").length,
      critical: activeAlerts.filter((a) => a.tier_label === "critical").length,
    };

    return NextResponse.json({
      alerts: alerts ?? [],
      totalOverdue: totalOverdue ?? 0,
      activeAlerts: activeAlerts.length,
      tierCounts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch alerts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — trigger flag run or dismiss an alert
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const body = await req.json();
    const { action } = body;

    // ── Trigger the edge function to flag overdue invoices ──────────────────
    if (action === "run_flag" || !action) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const sendEmails = body.send_emails !== false;
      const sendSms = body.send_sms !== false;

      const res = await fetch(`${supabaseUrl}/functions/v1/flag-overdue-invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ send_emails: sendEmails, send_sms: sendSms }),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || "Edge function failed", details: data },
          { status: 500 }
        );
      }
      return NextResponse.json(data);
    }

    // ── Dismiss an alert ────────────────────────────────────────────────────
    if (action === "dismiss") {
      const { alertId } = body;
      if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

      const { error } = await supabase
        .from("overdue_invoice_alerts")
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── Dismiss all alerts ──────────────────────────────────────────────────
    if (action === "dismiss_all") {
      const { error } = await supabase
        .from("overdue_invoice_alerts")
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq("dismissed", false);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
