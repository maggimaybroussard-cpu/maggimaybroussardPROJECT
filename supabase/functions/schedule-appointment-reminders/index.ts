import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Called by handle-calendly-booking after a new booking is confirmed.
 * Inserts two rows into appointment_reminders:
 *   - 24hr reminder: scheduled_at = startTime - 24 hours
 *   - 1hr reminder:  scheduled_at = startTime - 1 hour
 *
 * The process-sequences cron job picks these up and dispatches
 * send-appointment-reminder for each due row.
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
      eventName,
      startTime,
      meetingLocation,
      recipientPhone,
    } = await req.json();

    if (!inquiryId || !recipientEmail || !startTime) {
      return new Response(
        JSON.stringify({ error: "inquiryId, recipientEmail, and startTime are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const appointmentTime = new Date(startTime).getTime();
    const now = Date.now();

    const reminders: {
      inquiry_id: string;
      recipient_email: string;
      recipient_name: string;
      recipient_phone: string | null;
      event_name: string | null;
      start_time: string;
      meeting_location: string | null;
      reminder_type: "24hr" | "1hr";
      scheduled_at: string;
      send_status: "pending" | "skipped";
    }[] = [];

    // 24-hour reminder
    const scheduled24hr = appointmentTime - 24 * 60 * 60 * 1000;
    reminders.push({
      inquiry_id: inquiryId,
      recipient_email: recipientEmail,
      recipient_name: recipientName ?? "there",
      recipient_phone: recipientPhone ?? null,
      event_name: eventName ?? null,
      start_time: startTime,
      meeting_location: meetingLocation ?? null,
      reminder_type: "24hr",
      scheduled_at: new Date(scheduled24hr).toISOString(),
      send_status: scheduled24hr > now ? "pending" : "skipped",
    });

    // 1-hour reminder
    const scheduled1hr = appointmentTime - 60 * 60 * 1000;
    reminders.push({
      inquiry_id: inquiryId,
      recipient_email: recipientEmail,
      recipient_name: recipientName ?? "there",
      recipient_phone: recipientPhone ?? null,
      event_name: eventName ?? null,
      start_time: startTime,
      meeting_location: meetingLocation ?? null,
      reminder_type: "1hr",
      scheduled_at: new Date(scheduled1hr).toISOString(),
      send_status: scheduled1hr > now ? "pending" : "skipped",
    });

    const { data, error } = await supabase
      .from("appointment_reminders")
      .insert(reminders)
      .select("id, reminder_type, scheduled_at, send_status");

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true, remindersScheduled: data }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
