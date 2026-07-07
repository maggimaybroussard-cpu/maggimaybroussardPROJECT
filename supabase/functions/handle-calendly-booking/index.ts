import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Called by the Calendly webhook when a booking is created, canceled,
 * marked as no-show, or rescheduled.
 *
 * On creation:
 *  - Finds the matching contact inquiry by email
 *  - Updates booking_stage → 'consultation_booked' *  - Sets attendance_status →'pending'
 *  - Stores Calendly event UUID, start/end time, meeting location on the inquiry
 *  - Writes a rich case_timeline entry
 *  - Cancels pending booking_reminder sequences
 *  - Schedules the post-booking kickoff sequence
 *
 * On cancellation:
 *  - Clears the Calendly fields on the inquiry
 *  - Reverts booking_stage → 'inquiry' *  - Sets attendance_status →'canceled'
 *  - Writes a cancellation timeline entry
 *
 * On no-show:
 *  - Sets attendance_status → 'no_show'
 *  - Sets no_show_flagged → true
 *  - Applies -20 score delta to prospect_scores
 *  - Writes a no-show timeline entry
 *
 * On rescheduled:
 *  - Sets attendance_status → 'rescheduled'
 *  - Updates calendly_start_time / calendly_end_time
 *  - Writes a rescheduled timeline entry
 *
 * On attended (manual mark):
 *  - Sets attendance_status → 'attended'
 *  - Applies +15 score delta to prospect_scores
 *  - Writes an attended timeline entry
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
      phone,
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
      await supabase
        .from("contact_inquiries")
        .update({
          booking_stage: "inquiry",
          attendance_status: "canceled",
          calendly_event_uuid: null,
          calendly_start_time: null,
          calendly_end_time: null,
          calendly_event_name: null,
          calendly_meeting_location: null,
          calendly_invitee_uuid: null,
        })
        .eq("id", inquiry.id);

      await supabase.from("case_timeline").insert({
        inquiry_id: inquiry.id,
        event_title: "Consultation Canceled",
        event_description: cancelReason
          ? `Booking canceled. Reason: ${cancelReason}`
          : "The scheduled consultation was canceled via Calendly.",
        event_date: new Date().toISOString(),
      });

      await supabase
        .from("appointment_reminders")
        .update({ send_status: "skipped" })
        .eq("inquiry_id", inquiry.id)
        .eq("send_status", "pending");

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

    // ── NO-SHOW ───────────────────────────────────────────────────────────────
    if (action === "noshow") {
      // Flag the inquiry as no-show
      await supabase
        .from("contact_inquiries")
        .update({
          attendance_status: "no_show",
          no_show_flagged: true,
          attendance_scored_at: new Date().toISOString(),
          attendance_score_delta: -20,
        })
        .eq("id", inquiry.id);

      // Apply -20 score delta to prospect_scores
      const { data: existingScore } = await supabase
        .from("prospect_scores")
        .select("id, total_score, engagement_score, signals")
        .eq("inquiry_id", inquiry.id)
        .order("scored_at", { ascending: false })
        .limit(1)
        .single();

      if (existingScore) {
        const newTotal = Math.max(0, existingScore.total_score - 20);
        const newEngagement = Math.max(0, (existingScore.engagement_score ?? 0) - 20);
        const newTier = newTotal >= 70 ? "hot" : newTotal >= 45 ? "warm" : "cold";
        const existingSignals = existingScore.signals ?? {};
        const engagementSignals: string[] = existingSignals.engagement ?? [];

        await supabase
          .from("prospect_scores")
          .update({
            total_score: newTotal,
            engagement_score: newEngagement,
            score_tier: newTier,
            signals: {
              ...existingSignals,
              engagement: [...engagementSignals, "no_show: -20pts"],
            },
            recommended_action: "Re-engage: prospect did not attend scheduled consultation",
            scored_at: new Date().toISOString(),
          })
          .eq("id", existingScore.id);
      }

      // Write no-show timeline entry
      await supabase.from("case_timeline").insert({
        inquiry_id: inquiry.id,
        event_title: "🚫 No-Show — Consultation Missed",
        event_description:
          "Prospect did not attend the scheduled consultation. Lead score adjusted -20 pts. Follow-up recommended.",
        event_date: new Date().toISOString(),
      });

      // Skip pending appointment reminders
      await supabase
        .from("appointment_reminders")
        .update({ send_status: "skipped" })
        .eq("inquiry_id", inquiry.id)
        .eq("send_status", "pending");

      return new Response(
        JSON.stringify({ success: true, action: "noshow", inquiryId: inquiry.id, scoreDelta: -20 }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── RESCHEDULED ───────────────────────────────────────────────────────────
    if (action === "rescheduled") {
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

      await supabase
        .from("contact_inquiries")
        .update({
          attendance_status: "rescheduled",
          calendly_start_time: startTime ?? null,
          calendly_end_time: endTime ?? null,
          attendance_scored_at: new Date().toISOString(),
          attendance_score_delta: 0,
        })
        .eq("id", inquiry.id);

      await supabase.from("case_timeline").insert({
        inquiry_id: inquiry.id,
        event_title: "📅 Consultation Rescheduled",
        event_description: formattedDate
          ? `Consultation rescheduled to ${formattedDate}.`
          : "Consultation was rescheduled via Calendly.",
        event_date: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, action: "rescheduled", inquiryId: inquiry.id }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── ATTENDED (manual mark from admin) ─────────────────────────────────────
    if (action === "attended") {
      await supabase
        .from("contact_inquiries")
        .update({
          attendance_status: "attended",
          no_show_flagged: false,
          attendance_scored_at: new Date().toISOString(),
          attendance_score_delta: 15,
        })
        .eq("id", inquiry.id);

      // Apply +15 score delta to prospect_scores
      const { data: existingScore } = await supabase
        .from("prospect_scores")
        .select("id, total_score, engagement_score, signals")
        .eq("inquiry_id", inquiry.id)
        .order("scored_at", { ascending: false })
        .limit(1)
        .single();

      if (existingScore) {
        const newTotal = Math.min(100, existingScore.total_score + 15);
        const newEngagement = Math.min(100, (existingScore.engagement_score ?? 0) + 15);
        const newTier = newTotal >= 70 ? "hot" : newTotal >= 45 ? "warm" : "cold";
        const existingSignals = existingScore.signals ?? {};
        const engagementSignals: string[] = existingSignals.engagement ?? [];

        await supabase
          .from("prospect_scores")
          .update({
            total_score: newTotal,
            engagement_score: newEngagement,
            score_tier: newTier,
            signals: {
              ...existingSignals,
              engagement: [...engagementSignals, "attended_consultation: +15pts"],
            },
            recommended_action: "High intent: attended consultation — follow up with retainer proposal",
            scored_at: new Date().toISOString(),
          })
          .eq("id", existingScore.id);
      }

      await supabase.from("case_timeline").insert({
        inquiry_id: inquiry.id,
        event_title: "✅ Consultation Attended",
        event_description:
          "Prospect attended the scheduled consultation. Lead score adjusted +15 pts.",
        event_date: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, action: "attended", inquiryId: inquiry.id, scoreDelta: 15 }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── NEW BOOKING ──────────────────────────────────────────────────────────

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

    await supabase
      .from("contact_inquiries")
      .update({
        booking_stage: "consultation_booked",
        attendance_status: "pending",
        no_show_flagged: false,
        attendance_score_delta: 0,
        calendly_event_uuid: calendlyEventUuid ?? null,
        calendly_start_time: startTime ?? null,
        calendly_end_time: endTime ?? null,
        calendly_event_name: eventName ?? null,
        calendly_meeting_location: meetingLocation ?? null,
        calendly_invitee_uuid: inviteeUuid ?? null,
      })
      .eq("id", inquiry.id);

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

    const { data: cancelled } = await supabase
      .from("email_sequences")
      .update({ send_status: "skipped" })
      .eq("inquiry_id", inquiry.id)
      .eq("sequence_type", "booking_reminder")
      .eq("send_status", "pending")
      .select("id");

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
      // Non-blocking
    }

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
      // Non-blocking
    }

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
          recipientPhone: phone ?? null,
          eventName: eventName ?? null,
          startTime: startTime ?? null,
          meetingLocation: meetingLocation ?? null,
        }),
      });
    } catch {
      // Non-blocking
    }

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
      // Non-blocking
    }

    return new Response(
      JSON.stringify({
        success: true,
        inquiryId: inquiry.id,
        bookingStage: "consultation_booked",
        attendanceStatus: "pending",
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
