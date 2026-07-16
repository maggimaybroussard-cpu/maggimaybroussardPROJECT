import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * sync-to-google-calendar
 *
 * Creates or deletes a Google Calendar event for a confirmed Calendly booking.
 * Uses the admin's stored OAuth refresh token (from google_calendar_tokens table)
 * to obtain a fresh access token and call the Google Calendar REST API.
 *
 * Body (create):
 *   { action: "create", inquiryId, summary, description, startTime, endTime, timezone, location, attendeeEmail, attendeeName }
 *
 * Body (delete):
 *   { action: "delete", googleEventId }
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

  const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  try {
    const body = await req.json();
    const { action = "create" } = body;

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const GOOGLE_CLIENT_ID = (globalThis as any)?.Deno?.env?.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = (globalThis as any)?.Deno?.env?.get("GOOGLE_CLIENT_SECRET");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase credentials not configured" }), { status: 500, headers: CORS });
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Google OAuth credentials not configured" }), { status: 500, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Load stored token ────────────────────────────────────────────────────
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .limit(1)
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Google Calendar not connected. Please connect via Admin → Integrations." }),
        { status: 400, headers: CORS }
      );
    }

    // ── Refresh access token ─────────────────────────────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to refresh Google access token", detail: tokenData }),
        { status: 401, headers: CORS }
      );
    }

    const accessToken: string = tokenData.access_token;
    const calendarId: string = tokenRow.calendar_id ?? "primary";

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { googleEventId } = body;
      if (!googleEventId) {
        return new Response(JSON.stringify({ error: "googleEventId required for delete" }), { status: 400, headers: CORS });
      }

      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (delRes.status === 204 || delRes.status === 404) {
        return new Response(JSON.stringify({ success: true, deleted: googleEventId }), { headers: CORS });
      }

      const delErr = await delRes.text();
      return new Response(JSON.stringify({ error: "Failed to delete event", detail: delErr }), { status: 500, headers: CORS });
    }

    // ── CREATE ───────────────────────────────────────────────────────────────
    const {
      inquiryId,
      summary,
      description,
      startTime,
      endTime,
      timezone = "America/Chicago",
      location: meetingLocation,
      attendeeEmail,
      attendeeName,
    } = body;

    if (!startTime || !endTime) {
      return new Response(JSON.stringify({ error: "startTime and endTime are required" }), { status: 400, headers: CORS });
    }

    const eventBody: Record<string, unknown> = {
      summary: summary ?? "Consultation — Maggi May Broussard",
      description: description ?? "",
      start: { dateTime: startTime, timeZone: timezone },
      end: { dateTime: endTime, timeZone: timezone },
      colorId: "2", // sage green
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 1440 },  // 24 hr
          { method: "popup", minutes: 60 },     // 1 hr
        ],
      },
    };

    if (meetingLocation) {
      eventBody.location = meetingLocation;
    }

    if (attendeeEmail) {
      eventBody.attendees = [
        { email: attendeeEmail, displayName: attendeeName ?? attendeeEmail, responseStatus: "accepted" },
      ];
      eventBody.guestsCanSeeOtherGuests = false;
    }

    const createRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    const created = await createRes.json();

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ error: "Google Calendar API error", detail: created }),
        { status: createRes.status, headers: CORS }
      );
    }

    // Persist the Google event ID on the inquiry so we can delete it on cancellation
    if (inquiryId && created.id) {
      await supabase
        .from("contact_inquiries")
        .update({ google_calendar_event_id: created.id })
        .eq("id", inquiryId);
    }

    return new Response(
      JSON.stringify({ success: true, googleEventId: created.id, htmlLink: created.htmlLink }),
      { headers: CORS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORS });
  }
});
