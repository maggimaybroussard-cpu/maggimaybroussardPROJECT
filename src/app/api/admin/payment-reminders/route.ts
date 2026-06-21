import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Fetch client invoices with linked inquiry info
    let invoiceQuery = supabase
      .from("client_invoices")
      .select(`
        id,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        amount_paid,
        currency,
        status,
        notes,
        inquiry_id,
        created_at,
        updated_at,
        contact_inquiries (
          name,
          email,
          firm,
          service
        )
      `)
      .order("due_date", { ascending: true })
      .limit(limit);

    if (statusFilter && statusFilter !== "all") {
      invoiceQuery = invoiceQuery.eq("status", statusFilter);
    }

    const { data: invoices, error: invoiceError } = await invoiceQuery;
    if (invoiceError) throw invoiceError;

    // Fetch payment reminder sequences
    const { data: sequences, error: seqError } = await supabase
      .from("email_sequences")
      .select(`
        id,
        inquiry_id,
        sequence_type,
        step_number,
        scheduled_at,
        sent_at,
        send_status,
        resend_email_id,
        error_message,
        created_at,
        contact_inquiries (
          name,
          email,
          firm,
          service
        )
      `)
      .eq("sequence_type", "payment_reminder")
      .order("scheduled_at", { ascending: false })
      .limit(200);

    if (seqError) throw seqError;

    // Summary stats
    const allInvoices = invoices || [];
    const summary = {
      total: allInvoices.length,
      pending: allInvoices.filter((i) => i.status === "pending").length,
      overdue: allInvoices.filter((i) => i.status === "overdue").length,
      paid: allInvoices.filter((i) => i.status === "paid").length,
      cancelled: allInvoices.filter((i) => i.status === "cancelled").length,
      totalOutstanding: allInvoices
        .filter((i) => ["pending", "overdue"].includes(i.status))
        .reduce((sum, i) => sum + parseFloat(String(i.amount)) - parseFloat(String(i.amount_paid)), 0),
      remindersSent: (sequences || []).filter((s) => s.send_status === "sent").length,
      remindersPending: (sequences || []).filter((s) => s.send_status === "pending").length,
      remindersFailed: (sequences || []).filter((s) => s.send_status === "failed").length,
    };

    return NextResponse.json({
      invoices: invoices || [],
      sequences: sequences || [],
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch payment reminders data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const body = await req.json();
    const { action } = body;

    // ── Trigger full payment reminder run ──────────────────────────────────────
    if (action === "run_all" || !action) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const token = authHeader.replace("Bearer ", "");
      const verifyClient = createClient(supabaseUrl, serviceRoleKey ?? anonKey);
      const { data: { user }, error: authError } = await verifyClient.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const invokeKey = serviceRoleKey ?? token;
      const res = await fetch(`${supabaseUrl}/functions/v1/schedule-payment-reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${invokeKey}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || data.message || "Edge function failed", details: data },
          { status: 500 }
        );
      }
      return NextResponse.json(data);
    }

    const supabase = supabaseAdmin();

    // ── Resend a specific reminder sequence ────────────────────────────────────
    if (action === "resend") {
      const { sequenceId } = body;
      if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

      const { data: seq, error: seqErr } = await supabase
        .from("email_sequences")
        .select(`id, sequence_type, step_number, inquiry_id, contact_inquiries ( name, email, service )`)
        .eq("id", sequenceId)
        .single();

      if (seqErr || !seq) throw new Error("Sequence not found");

      const inquiry = (seq as any).contact_inquiries;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-nurture-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          sequenceId: seq.id,
          inquiryId: (seq as any).inquiry_id,
          sequenceType: seq.sequence_type,
          stepNumber: seq.step_number,
          recipientEmail: inquiry?.email,
          recipientName: inquiry?.name,
          service: inquiry?.service,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to resend email");
      return NextResponse.json({ success: true, emailId: result.id });
    }

    // ── Cancel a pending reminder ──────────────────────────────────────────────
    if (action === "cancel_reminder") {
      const { sequenceId } = body;
      if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });
      const { error } = await supabase
        .from("email_sequences")
        .update({ send_status: "skipped" })
        .eq("id", sequenceId)
        .eq("send_status", "pending");
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── Reschedule a reminder ──────────────────────────────────────────────────
    if (action === "reschedule") {
      const { sequenceId, scheduledAt } = body;
      if (!sequenceId || !scheduledAt) {
        return NextResponse.json({ error: "sequenceId and scheduledAt required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("email_sequences")
        .update({ scheduled_at: scheduledAt, send_status: "pending" })
        .eq("id", sequenceId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── Update invoice status ──────────────────────────────────────────────────
    if (action === "update_invoice_status") {
      const { invoiceId, status } = body;
      if (!invoiceId || !status) {
        return NextResponse.json({ error: "invoiceId and status required" }, { status: 400 });
      }
      const validStatuses = ["pending", "paid", "overdue", "cancelled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const { error } = await supabase
        .from("client_invoices")
        .update({ status })
        .eq("id", invoiceId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── Mark invoice as paid ───────────────────────────────────────────────────
    if (action === "mark_paid") {
      const { invoiceId, amountPaid } = body;
      if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
      const { data: inv, error: fetchErr } = await supabase
        .from("client_invoices")
        .select("amount")
        .eq("id", invoiceId)
        .single();
      if (fetchErr || !inv) throw new Error("Invoice not found");
      const paid = amountPaid ?? inv.amount;
      const { error } = await supabase
        .from("client_invoices")
        .update({ status: "paid", amount_paid: paid })
        .eq("id", invoiceId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
