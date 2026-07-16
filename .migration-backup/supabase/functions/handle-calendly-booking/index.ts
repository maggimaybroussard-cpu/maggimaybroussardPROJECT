import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Called by the Calendly webhook when a booking is created or canceled.
 *
 * On creation:
 *  - Finds the matching contact inquiry by email
 *  - Updates booking_stage → 'consultation_booked'
 *  - Stores Calendly event UUID, start/end time, meeting location on the inquiry
 *  - Writes a rich case_timeline entry
 *  - Cancels pending booking_reminder sequences
 *  - Schedules the post-booking kickoff sequence
 *
 * On cancellation:
 *  - Clears the Calendly fields on the inquiry
 *  - Reverts booking_stage → 'inquiry'
 *  - Writes a cancellation timeline entry
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
    const body = await req.json();
    const {
      email,
      name,
      eventName,
      startTime,
      endTime,
      meetingLocation,
      calendlyEventUuid,
      inviteeUuid,
      timezone,
      action,
      cancelReason,
    } = body;

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the most recent active inquiry for this email
    const { data: inquiry, error: inquiryErr } = await supabase
      .from("contact_inquiries")
      .select("id, name, service, booking_stage")
      .eq("email", email)
      .not("booking_stage", "in", '("completed","closed")')
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (inquiryErr || !inquiry) {
      return new Response(
        JSON.stringify({ success: true, message: "No matching inquiry found" }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── CANCELLATION ─────────────────────────────────────────────────────────
    if (action === "canceled") {
      // Clear Calendly fields and revert booking stage
      await supabase
        .from("contact_inquiries")
        .update({
          booking_stage: "inquiry",
          calendly_event_uuid: null,
          calendly_start_time: null,
          calendly_end_time: null,
          calendly_event_name: null,
          calendly_meeting_location: null,
          calendly_invitee_uuid: null,
        })
        .eq("id", inquiry.id);

      // Write cancellation timeline entry
      await supabase.from("case_timeline").insert({
        inquiry_id: inquiry.id,
        event_title: "Consultation Canceled",
        event_description: cancelReason
          ? `Booking canceled. Reason: ${cancelReason}`
          : "The scheduled consultation was canceled via Calendly.",
        event_date: new Date().toISOString(),
      });

      // Skip any pending appointment reminders for this inquiry
      await supabase
        .from("appointment_reminders")
        .update({ send_status: "skipped" })
        .eq("inquiry_id", inquiry.id)
        .eq("send_status", "pending");

      // Delete the Google Calendar event if one was created
      try {
        const { data: inquiryWithGcal } = await supabase
          .from("contact_inquiries")
          .select("google_calendar_event_id")
          .eq("id", inquiry.id)
          .single();

        if (inquiryWithGcal?.google_calendar_event_id) {
          await fetch(`${SUPABASE_URL}/functions/v1/sync-to-google-calendar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              action: "delete",
              googleEventId: inquiryWithGcal.google_calendar_event_id,
            }),
          });

          // Clear the stored event ID
          await supabase
            .from("contact_inquiries")
            .update({ google_calendar_event_id: null })
            .eq("id", inquiry.id);
        }
      } catch {
        // Non-blocking
      }

      return new Response(
        JSON.stringify({ success: true, action: "canceled", inquiryId: inquiry.id }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── NEW BOOKING ──────────────────────────────────────────────────────────

    // Format the appointment date for the timeline description
    let formattedDate = "";
    if (startTime) {
      try {
        formattedDate = new Date(startTime).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone ?? "America/Chicago",
          timeZoneName: "short",
        });
      } catch {
        formattedDate = startTime;
      }
    }

    // Update inquiry: booking_stage + all Calendly fields
    await supabase
      .from("contact_inquiries")
      .update({
        booking_stage: "consultation_booked",
        calendly_event_uuid: calendlyEventUuid ?? null,
        calendly_start_time: startTime ?? null,
        calendly_end_time: endTime ?? null,
        calendly_event_name: eventName ?? null,
        calendly_meeting_location: meetingLocation ?? null,
        calendly_invitee_uuid: inviteeUuid ?? null,
      })
      .eq("id", inquiry.id);

    // Write a rich timeline entry for the booking
    await supabase.from("case_timeline").insert({
      inquiry_id: inquiry.id,
      event_title: eventName ?? "Consultation Booked",
      event_description: [
        formattedDate ? `Scheduled for ${formattedDate}` : null,
        meetingLocation ? `Location: ${meetingLocation}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Your consultation has been confirmed via Calendly.",
      event_date: startTime ?? new Date().toISOString(),
    });

    // Cancel pending booking_reminder sequences — lead has converted
    const { data: cancelled } = await supabase
      .from("email_sequences")
      .update({ send_status: "skipped" })
      .eq("inquiry_id", inquiry.id)
      .eq("sequence_type", "booking_reminder")
      .eq("send_status", "pending")
      .select("id");

    // Schedule the post-booking kickoff sequence
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/schedule-post-booking-sequence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          recipientEmail: email,
          recipientName: name ?? inquiry.name,
          service: inquiry.service,
          eventDate: formattedDate || null,
        }),
      });
    } catch {
      // Non-blocking — post-booking sequence failure shouldn't abort the webhook response
    }

    // Schedule the 5-day review request email
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/schedule-review-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          recipientEmail: email,
          recipientName: name ?? inquiry.name,
          service: inquiry.service,
        }),
      });
    } catch {
      // Non-blocking — review request scheduling failure shouldn't abort the webhook response
    }

    // Schedule 24hr and 1hr appointment reminder emails
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/schedule-appointment-reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          recipientEmail: email,
          recipientName: name ?? inquiry.name,
          eventName: eventName ?? null,
          startTime: startTime ?? null,
          meetingLocation: meetingLocation ?? null,
        }),
      });
    } catch {
      // Non-blocking — reminder scheduling failure shouldn't abort the webhook response
    }

    // Sync to Google Calendar (non-blocking)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/sync-to-google-calendar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: "create",
          inquiryId: inquiry.id,
          summary: eventName ?? "Consultation — Maggi May Broussard",
          description: [
            `Client: ${name ?? inquiry.name}`,
            `Service: ${inquiry.service}`,
            meetingLocation ? `Location: ${meetingLocation}` : null,
          ].filter(Boolean).join("\n"),
          startTime: startTime ?? null,
          endTime: endTime ?? null,
          timezone: timezone ?? "America/Chicago",
          location: meetingLocation ?? null,
          attendeeEmail: email,
          attendeeName: name ?? inquiry.name,
        }),
      });
    } catch {
      // Non-blocking — Google Calendar sync failure shouldn't abort the webhook response
    }

    return new Response(
      JSON.stringify({
        success: true,
        inquiryId: inquiry.id,
        bookingStage: "consultation_booked",
        calendlyEventUuid,
        cancelledReminders: cancelled?.length ?? 0,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
