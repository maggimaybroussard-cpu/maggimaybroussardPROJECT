import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * schedule-deadline-reminders
 *
 * Queries upcoming case_schedule_events and sends email reminders
 * to assigned paralegals X days before the event date.
 *
 * Designed to be called:
 *   - Via a daily cron job (Supabase pg_cron or external scheduler)
 *   - Manually via the admin API route /api/admin/trigger-deadline-reminders
 *
 * Logic:
 *   1. Load reminder_settings per event_type (days_before, enabled)
 *   2. For each enabled event_type, find events where:
 *      - status = 'upcoming'
 *      - event_date is exactly `days_before` days from today (±12h window)
 *      - reminder_sent_at IS NULL (not already sent)
 *      - assigned_to is not null/empty
 *   3. For each matching event, invoke send-deadline-reminder edge function
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
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Load reminder settings
    const { data: settings, error: settingsErr } = await supabase
      .from("reminder_settings")
      .select("*");

    if (settingsErr) throw new Error(`Failed to load reminder settings: ${settingsErr.message}`);

    const enabledSettings = (settings ?? []).filter((s: any) => s.enabled);

    const results: { eventId: string; eventTitle: string; status: string; error?: string }[] = [];

    for (const setting of enabledSettings) {
      const { event_type, days_before } = setting;

      // Calculate the target date window: events happening in exactly `days_before` days
      const now = new Date();
      const targetStart = new Date(now);
      targetStart.setDate(targetStart.getDate() + days_before);
      targetStart.setHours(0, 0, 0, 0);

      const targetEnd = new Date(targetStart);
      targetEnd.setHours(23, 59, 59, 999);

      // 2. Find matching events
      const { data: events, error: eventsErr } = await supabase
        .from("case_schedule_events")
        .select("*")
        .eq("event_type", event_type)
        .eq("status", "upcoming")
        .is("reminder_sent_at", null)
        .gte("event_date", targetStart.toISOString())
        .lte("event_date", targetEnd.toISOString())
        .not("assigned_to", "is", null)
        .neq("assigned_to", "");

      if (eventsErr) {
        console.error(`Error fetching ${event_type} events:`, eventsErr.message);
        continue;
      }

      for (const event of (events ?? [])) {
        try {
          // Look up paralegal email from user_profiles if available
          let paralegalEmail: string | null = null;
          let paralegalName: string = event.assigned_to;

          // Try to find paralegal email in user_profiles by name
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("email, full_name")
            .ilike("full_name", `%${event.assigned_to}%`)
            .eq("role", "paralegal")
            .maybeSingle();

          if (profile?.email) {
            paralegalEmail = profile.email;
            paralegalName = profile.full_name || event.assigned_to;
          } else {
            // Fallback: if assigned_to looks like an email, use it directly
            if (event.assigned_to && event.assigned_to.includes("@")) {
              paralegalEmail = event.assigned_to;
            }
          }

          if (!paralegalEmail) {
            results.push({
              eventId: event.id,
              eventTitle: event.title,
              status: "skipped",
              error: `No email found for paralegal: ${event.assigned_to}`,
            });
            continue;
          }

          // 3. Invoke send-deadline-reminder
          const sendRes = await fetch(
            `${SUPABASE_URL}/functions/v1/send-deadline-reminder`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                eventId: event.id,
                paralegalEmail,
                paralegalName,
                eventType: event.event_type,
                eventTitle: event.title,
                caseName: event.case_name,
                eventDate: event.event_date,
                location: event.location,
                description: event.description,
                notes: event.notes,
                daysBefore: days_before,
              }),
            }
          );

          const sendData = await sendRes.json();

          if (!sendRes.ok) {
            results.push({
              eventId: event.id,
              eventTitle: event.title,
              status: "failed",
              error: sendData.error || "Unknown error",
            });
          } else {
            results.push({
              eventId: event.id,
              eventTitle: event.title,
              status: "sent",
            });
          }
        } catch (err: any) {
          results.push({
            eventId: event.id,
            eventTitle: event.title,
            status: "failed",
            error: err.message,
          });
        }
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return new Response(
      JSON.stringify({
        success: true,
        summary: { sent, skipped, failed, total: results.length },
        results,
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
