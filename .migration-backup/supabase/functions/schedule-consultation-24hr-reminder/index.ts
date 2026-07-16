import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Called after a consultation booking is confirmed.
 * Inserts a row into consultation_reminder_logs with scheduled_at = bookingDateTime - 24 hours.
 * The process-sequences cron job picks up due rows and invokes send-consultation-24hr-reminder.
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
      bookingId,
      clientEmail,
      clientName,
      clientPhone,
      bookingDate,   // "YYYY-MM-DD"
      bookingTime,   // "HH:MM"
      durationMinutes,
      meetingLink,
    } = await req.json();

    if (!bookingId || !clientEmail || !bookingDate || !bookingTime) {
      return new Response(
        JSON.stringify({ error: "bookingId, clientEmail, bookingDate, and bookingTime are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build the booking datetime in UTC (treat bookingDate + bookingTime as local CST = UTC-5/6)
    const [y, m, d] = bookingDate.split("-").map(Number);
    const [h, min] = bookingTime.split(":").map(Number);
    // Approximate CST offset (UTC-6 standard, UTC-5 daylight) — use UTC-6 conservatively
    const bookingDateTimeUTC = new Date(Date.UTC(y, m - 1, d, h + 6, min, 0));
    const scheduledAt = new Date(bookingDateTimeUTC.getTime() - 24 * 60 * 60 * 1000);
    const now = Date.now();

    const sendStatus = scheduledAt.getTime() > now ? "pending" : "skipped";

    const { data, error } = await supabase
      .from("consultation_reminder_logs")
      .insert({
        booking_id: bookingId,
        reminder_type: "24hr",
        recipient_email: clientEmail,
        recipient_name: clientName ?? "there",
        recipient_phone: clientPhone ?? null,
        booking_date: bookingDate,
        booking_time: bookingTime,
        duration_minutes: durationMinutes ?? 30,
        meeting_link: meetingLink ?? null,
        scheduled_at: scheduledAt.toISOString(),
        send_status: sendStatus,
      })
      .select("id, scheduled_at, send_status")
      .single();

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true, reminder: data }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
