/**
 * Shared Google Calendar helper utilities.
 * Used by API routes to create, update, and delete calendar events
 * for paralegal consultations booked via the portal or Lexi.
 */

import { createClient } from '@supabase/supabase-js';

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  initial_consultation: 'Initial Consultation',
  follow_up: 'Follow-Up Meeting',
  document_review: 'Document Review',
  deposition_prep: 'Deposition Prep',
  strategy_session: 'Strategy Session',
  signing: 'Contract Signing',
  case_checkin: 'Case Check-In',
};

const APPOINTMENT_DURATIONS: Record<string, number> = {
  initial_consultation: 60,
  follow_up: 30,
  document_review: 45,
  deposition_prep: 90,
  strategy_session: 60,
  signing: 30,
  case_checkin: 20,
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Refresh the stored Google OAuth access token.
 * Returns { accessToken, calendarId } or null if not connected / credentials missing.
 */
export async function getGoogleAccessToken(): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || clientId === 'your-google-client-id-here' || !clientSecret || clientSecret === 'your-google-client-secret-here') {
    return null;
  }

  const supabase = getServiceClient();
  const { data: tokenRow } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .limit(1)
    .single();

  if (!tokenRow?.refresh_token) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return null;

  return {
    accessToken: tokenData.access_token,
    calendarId: tokenRow.calendar_id ?? 'primary',
  };
}

export interface CreateCalendarEventParams {
  clientName: string;
  clientEmail: string;
  appointmentType: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM
  timezone: string;
  notes?: string | null;
  meetingLocation?: string | null;
}

/**
 * Create a Google Calendar event for a consultation.
 * Returns the Google Calendar event ID, or null on failure.
 */
export async function createCalendarEvent(
  params: CreateCalendarEventParams
): Promise<{ googleEventId: string; htmlLink: string } | null> {
  try {
    const auth = await getGoogleAccessToken();
    if (!auth) return null;

    const typeLabel = APPOINTMENT_TYPE_LABELS[params.appointmentType] ?? params.appointmentType;
    const durationMinutes = APPOINTMENT_DURATIONS[params.appointmentType] ?? 60;

    const startDateTime = `${params.appointmentDate}T${params.appointmentTime}:00`;
    const endDate = new Date(`${params.appointmentDate}T${params.appointmentTime}:00`);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    const endDateTime = endDate.toISOString().slice(0, 19);

    const descriptionParts = [
      `Paralegal Consultation — ${typeLabel}`,
      `Client: ${params.clientName}`,
      params.notes ? `Notes: ${params.notes}` : null,
      params.meetingLocation ? `Location: ${params.meetingLocation}` : null,
      '',
      '— Broussard Legal Services',
    ].filter((p) => p !== null);

    const eventBody: Record<string, unknown> = {
      summary: `${typeLabel} — ${params.clientName}`,
      description: descriptionParts.join('\n'),
      start: { dateTime: startDateTime, timeZone: params.timezone },
      end: { dateTime: endDateTime, timeZone: params.timezone },
      colorId: '2', // sage green
      attendees: [
        {
          email: params.clientEmail,
          displayName: params.clientName,
          responseStatus: 'accepted',
        },
      ],
      guestsCanSeeOtherGuests: false,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    if (params.meetingLocation) {
      eventBody.location = params.meetingLocation;
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return { googleEventId: data.id, htmlLink: data.htmlLink ?? '' };
  } catch {
    return null;
  }
}

/**
 * Update an existing Google Calendar event (reschedule).
 * Returns true on success.
 */
export async function updateCalendarEvent(
  googleEventId: string,
  params: CreateCalendarEventParams
): Promise<boolean> {
  try {
    const auth = await getGoogleAccessToken();
    if (!auth) return false;

    const typeLabel = APPOINTMENT_TYPE_LABELS[params.appointmentType] ?? params.appointmentType;
    const durationMinutes = APPOINTMENT_DURATIONS[params.appointmentType] ?? 60;

    const startDateTime = `${params.appointmentDate}T${params.appointmentTime}:00`;
    const endDate = new Date(`${params.appointmentDate}T${params.appointmentTime}:00`);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    const endDateTime = endDate.toISOString().slice(0, 19);

    const descriptionParts = [
      `Paralegal Consultation — ${typeLabel}`,
      `Client: ${params.clientName}`,
      params.notes ? `Notes: ${params.notes}` : null,
      params.meetingLocation ? `Location: ${params.meetingLocation}` : null,
      '',
      '— Broussard Legal Services',
    ].filter((p) => p !== null);

    const eventBody: Record<string, unknown> = {
      summary: `${typeLabel} — ${params.clientName}`,
      description: descriptionParts.join('\n'),
      start: { dateTime: startDateTime, timeZone: params.timezone },
      end: { dateTime: endDateTime, timeZone: params.timezone },
      colorId: '5', // banana/yellow for rescheduled
      attendees: [
        {
          email: params.clientEmail,
          displayName: params.clientName,
          responseStatus: 'accepted',
        },
      ],
      guestsCanSeeOtherGuests: false,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    if (params.meetingLocation) {
      eventBody.location = params.meetingLocation;
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a Google Calendar event (cancellation).
 * Returns true on success.
 */
export async function deleteCalendarEvent(googleEventId: string): Promise<boolean> {
  try {
    const auth = await getGoogleAccessToken();
    if (!auth) return false;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      }
    );

    return res.status === 204 || res.status === 404;
  } catch {
    return false;
  }
}

/**
 * Fetch upcoming consultation events from Google Calendar.
 * Returns a list of events or empty array.
 */
export async function fetchUpcomingCalendarEvents(maxResults = 20): Promise<
  Array<{
    id: string;
    summary: string;
    description: string;
    start: string;
    end: string;
    htmlLink: string;
    attendees: Array<{ email: string; displayName?: string }>;
  }>
> {
  try {
    const auth = await getGoogleAccessToken();
    if (!auth) return [];

    const now = new Date().toISOString();
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`
    );
    url.searchParams.set('timeMin', now);
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.items ?? []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      summary: (item.summary as string) ?? '',
      description: (item.description as string) ?? '',
      start: ((item.start as Record<string, string>)?.dateTime ?? (item.start as Record<string, string>)?.date ?? '') as string,
      end: ((item.end as Record<string, string>)?.dateTime ?? (item.end as Record<string, string>)?.date ?? '') as string,
      htmlLink: (item.htmlLink as string) ?? '',
      attendees: ((item.attendees as Array<{ email: string; displayName?: string }>) ?? []),
    }));
  } catch {
    return [];
  }
}
