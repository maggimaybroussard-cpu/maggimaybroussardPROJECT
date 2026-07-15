import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGoogleAccessToken } from '@/lib/googleCalendar';
import { sendAppointmentConfirmationSMS } from '@/lib/twilio/smsClient';
import { sendGmailEmail } from '@/lib/gmail/gmailClient';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  green: '#355E3B',
  greenLight: 'rgba(53,94,59,0.08)',
  greenBorder: 'rgba(53,94,59,0.18)',
  blue: '#1a73e8',
  blueLight: 'rgba(26,115,232,0.08)',
  blueBorder: 'rgba(26,115,232,0.18)',
  msBlue: '#0078d4',
  msBlueLight: 'rgba(0,120,212,0.08)',
  msBlueBorder: 'rgba(0,120,212,0.18)',
};

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return timeStr; }
}

/**
 * Build a Google Calendar "Add to Calendar" URL
 */
function buildGoogleCalendarUrl(params: {
  title: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  description: string;
  location: string;
}): string {
  const [y, m, d] = params.startDate.split('-').map(Number);
  const [h, min] = params.startTime.split(':').map(Number);
  const start = new Date(y, m - 1, d, h, min, 0);
  const end = new Date(start.getTime() + params.durationMinutes * 60000);

  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`;

  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: params.description,
    location: params.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/**
 * Create a real Google Calendar event with Google Meet via the Calendar API.
 * Returns { meetingLink, googleEventId, htmlLink } or falls back to a placeholder.
 */
async function createGoogleCalendarEventWithMeet(params: {
  clientName: string;
  clientEmail: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  notes?: string;
}): Promise<{ meetingLink: string; googleEventId: string | null; htmlLink: string | null }> {
  try {
    const auth = await getGoogleAccessToken();
    if (!auth) {
      // Fallback: generate a placeholder Meet-style link
      const token = Math.random().toString(36).substring(2, 10);
      return {
        meetingLink: `https://meet.google.com/${token.substring(0, 3)}-${token.substring(3, 7)}-${token.substring(7)}`,
        googleEventId: null,
        htmlLink: null,
      };
    }

    const [y, m, d] = params.bookingDate.split('-').map(Number);
    const [h, min] = params.bookingTime.split(':').map(Number);
    const startDt = new Date(y, m - 1, d, h, min, 0);
    const endDt = new Date(startDt.getTime() + params.durationMinutes * 60000);

    const fmt = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:00`;

    const durationLabel =
      params.durationMinutes === 15 ? '15-Minute' :
      params.durationMinutes === 60 ? '60-Minute' : '30-Minute';

    const descriptionParts = [
      `${durationLabel} Paralegal Consultation — Broussard Legal Services`,
      `Client: ${params.clientName}`,
      params.notes ? `Notes: ${params.notes}` : null,
      '',
      'Please have ready:',
      '• Summary of your matter',
      '• Relevant documents',
      '• Your top 3–5 questions',
      '',
      '— Maggi May Broussard | broussardlegalservices.com',
    ].filter((p) => p !== null).join('\n');

    const eventBody = {
      summary: `${durationLabel} Consultation — ${params.clientName}`,
      description: descriptionParts,
      start: { dateTime: fmt(startDt), timeZone: 'America/Chicago' },
      end: { dateTime: fmt(endDt), timeZone: 'America/Chicago' },
      colorId: '2', // sage green
      attendees: [
        { email: params.clientEmail, displayName: params.clientName, responseStatus: 'accepted' },
      ],
      guestsCanSeeOtherGuests: false,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: `consultation-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events?sendUpdates=all&conferenceDataVersion=1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!res.ok) {
      const token = Math.random().toString(36).substring(2, 10);
      return {
        meetingLink: `https://meet.google.com/${token.substring(0, 3)}-${token.substring(3, 7)}-${token.substring(7)}`,
        googleEventId: null,
        htmlLink: null,
      };
    }

    const data = await res.json();
    const meetingLink =
      data?.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video')?.uri ||
      data?.hangoutLink ||
      (() => {
        const token = Math.random().toString(36).substring(2, 10);
        return `https://meet.google.com/${token.substring(0, 3)}-${token.substring(3, 7)}-${token.substring(7)}`;
      })();

    return {
      meetingLink,
      googleEventId: data.id ?? null,
      htmlLink: data.htmlLink ?? null,
    };
  } catch {
    const token = Math.random().toString(36).substring(2, 10);
    return {
      meetingLink: `https://meet.google.com/${token.substring(0, 3)}-${token.substring(3, 7)}-${token.substring(7)}`,
      googleEventId: null,
      htmlLink: null,
    };
  }
}

function buildConfirmationEmail(params: {
  clientName: string;
  clientEmail: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  bookingId: string;
  meetingLink: string;
  googleCalendarUrl: string;
  icsDownloadUrl: string;
  prepDocuments?: Array<{ fileName: string; publicUrl: string | null; description: string | null }>;
}): string {
  const { clientName, bookingDate, bookingTime, durationMinutes, meetingLink, googleCalendarUrl, icsDownloadUrl, prepDocuments } = params;
  const firstName = clientName.split(' ')[0];
  const formattedDate = formatDate(bookingDate);
  const formattedTime = formatTime(bookingTime);
  const durationLabel =
    durationMinutes === 15 ? '15-minute' : durationMinutes === 60 ? '60-minute' : '30-minute';

  const prepItems = [
    { icon: '📋', title: 'Summary of your matter', detail: 'A brief written overview of your legal support needs, timeline, and any key parties involved.' },
    { icon: '📄', title: 'Relevant documents', detail: 'Contracts, correspondence, court filings, or any paperwork related to your situation.' },
    { icon: '❓', title: 'Your questions', detail: 'Write down your top 3–5 questions so we can cover what matters most to you.' },
    { icon: '🎯', title: 'Your goals', detail: 'What outcome are you hoping for? Understanding your priorities helps us advise you effectively.' },
    { icon: '📅', title: 'Key dates & deadlines', detail: 'Any upcoming court dates, filing deadlines, or contract expiration dates we should know about.' },
  ];

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <!-- Header accent bar -->
        <tr><td style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></td></tr>
        <!-- Brand header -->
        <tr>
          <td style="background-color:${brand.primary};padding:28px 36px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                </td>
                <td style="padding-left:14px;vertical-align:middle;">
                  <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
                  <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Confirmation badge -->
        <tr>
          <td style="padding:32px 36px 0;">
            <div style="display:inline-block;padding:8px 18px;background-color:rgba(53,94,59,0.1);border-radius:20px;margin-bottom:20px;">
              <span style="font-size:13px;color:${brand.green};font-family:Georgia,serif;font-weight:bold;letter-spacing:0.04em;">&#10003; Consultation Confirmed</span>
            </div>
            <h2 style="margin:0 0 8px;font-size:22px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;">Your ${durationLabel} consultation is booked, ${firstName}.</h2>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">We look forward to speaking with you. Here are your booking details and everything you need to prepare.</p>
          </td>
        </tr>
        <!-- Booking details card -->
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-bottom:14px;border-bottom:1px solid ${brand.border};">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Date</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${formattedDate}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0;border-bottom:1px solid ${brand.border};">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Time</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${formattedTime} CST &nbsp;&middot;&nbsp; ${durationMinutes} minutes</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:14px;">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Google Meet Link</p>
                        <a href="${meetingLink}" style="font-size:15px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">${meetingLink}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Action buttons row -->
        <tr>
          <td style="padding:0 36px 28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:10px;">
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                        <a href="${meetingLink}" style="display:inline-block;padding:12px 22px;color:${brand.white};text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">&#128249; Join Meeting</a>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding-right:10px;">
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="background-color:${brand.blue};border-radius:7px;">
                        <a href="${googleCalendarUrl}" style="display:inline-block;padding:12px 22px;color:${brand.white};text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">&#128197; Add to Google Calendar</a>
                      </td>
                    </tr>
                  </table>
                </td>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="background-color:${brand.msBlue};border-radius:7px;">
                        <a href="${icsDownloadUrl}" style="display:inline-block;padding:12px 22px;color:${brand.white};text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">&#128197; Add to Outlook / Apple</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Prep instructions -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="border-top:1px solid ${brand.border};padding-top:24px;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">How to Prepare</p>
              <p style="margin:0 0 18px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">To make the most of your ${durationLabel} session, please have the following ready:</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${prepItems.map((item, i) => `
                <tr>
                  <td style="padding:${i === 0 ? '0' : '12px'} 0 12px;${i < prepItems.length - 1 ? `border-bottom:1px solid ${brand.border};` : ''}">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;font-size:18px;line-height:1;">${item.icon}</td>
                        <td>
                          <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${item.title}</p>
                          <p style="margin:0;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">${item.detail}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>
            </div>
          </td>
        </tr>
        ${prepDocuments && prepDocuments.length > 0 ? `
        <!-- Prep Documents -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};overflow:hidden;">
              <div style="background-color:${brand.primary};padding:12px 22px;">
                <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128196;&nbsp; Prep Resources Attached</p>
              </div>
              <div style="padding:18px 22px;">
                <p style="margin:0 0 14px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">Please review these materials before your consultation:</p>
                ${prepDocuments.map((doc, i) => `
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:${i < prepDocuments.length - 1 ? '12px' : '0'};padding-bottom:${i < prepDocuments.length - 1 ? '12px' : '0'};border-bottom:${i < prepDocuments.length - 1 ? `1px solid ${brand.border}` : 'none'};">
                  <tr>
                    <td style="vertical-align:top;padding-right:10px;width:20px;"><span style="font-size:14px;">&#128196;</span></td>
                    <td>
                      <p style="margin:0 0 2px;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${doc.fileName}</p>
                      ${doc.description ? `<p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">${doc.description}</p>` : ''}
                      ${doc.publicUrl ? `<table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="background-color:${brand.accent};border-radius:5px;"><a href="${doc.publicUrl}" style="display:inline-block;padding:6px 14px;color:${brand.white};text-decoration:none;font-size:11px;font-family:Georgia,serif;font-weight:bold;">Download &rarr;</a></td></tr></table>` : ''}
                    </td>
                  </tr>
                </table>`).join('')}
              </div>
            </div>
          </td>
        </tr>` : ''}
        <!-- Portal CTA -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.greenLight};border:1px solid ${brand.greenBorder};border-radius:10px;padding:18px 22px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:${brand.green};font-family:Georgia,serif;">Access Your Client Portal</p>
              <p style="margin:0 0 12px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">Upload documents, track your matter, and communicate securely before your consultation.</p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border:1px solid ${brand.greenBorder};border-radius:6px;">
                    <a href="${SITE_URL}/portal/dashboard" style="display:inline-block;padding:10px 20px;color:${brand.green};text-decoration:none;font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Go to Portal &rarr;</a>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <!-- Contact reminders -->
        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Need to Reach Us?</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:1px solid ${brand.border};">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding-right:10px;font-size:16px;">✉️</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
                          <a href="mailto:broussardlegalservices@gmail.com" style="font-size:14px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">broussardlegalservices@gmail.com</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;padding-bottom:10px;border-bottom:1px solid ${brand.border};">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding-right:10px;font-size:16px;">🌐</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Website</p>
                          <a href="${SITE_URL}" style="font-size:14px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">${SITE_URL.replace('https://', '')}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding-right:10px;font-size:16px;">🔒</td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">Secure Messaging</p>
                          <a href="${SITE_URL}/portal/messages" style="font-size:14px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">Send a message via Client Portal</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;font-style:italic;">Need to reschedule? Reply to this email at least 24 hours before your appointment and we will find a new time that works for you.</p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;&middot;&nbsp; Louisiana &amp; Nationwide</p>
            <p style="margin:6px 0 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent};text-decoration:none;">broussardlegalservices@gmail.com</a>
            </p>
            <p style="margin:8px 0 0;font-size:10px;color:${brand.muted};font-family:Georgia,serif;opacity:0.7;">This email was sent to confirm your consultation booking. Attorney-client privilege applies from first contact.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      bookingDate,
      bookingTime,
      durationMinutes = 30,
      notes,
      inquiryId,
      clientPhone,
      smsConsent,
    }: {
      clientName: string;
      clientEmail: string;
      bookingDate: string;
      bookingTime: string;
      durationMinutes?: number;
      notes?: string;
      inquiryId?: string;
      clientPhone?: string;
      smsConsent?: boolean;
    } = body;

    if (!clientName || !clientEmail || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { error: 'Missing required fields: clientName, clientEmail, bookingDate, bookingTime' },
        { status: 400 }
      );
    }

    if (![15, 30, 60].includes(durationMinutes)) {
      return NextResponse.json(
        { error: 'durationMinutes must be 15, 30, or 60' },
        { status: 400 }
      );
    }

    // Check for conflicts
    const { data: existing } = await supabaseAdmin
      .from('consultation_bookings')
      .select('id, booking_time, duration_minutes')
      .eq('booking_date', bookingDate)
      .not('status', 'eq', 'cancelled');

    const requestedStart = bookingTime.substring(0, 5);
    const [rh, rm] = requestedStart.split(':').map(Number);
    const requestedStartMin = rh * 60 + rm;
    const requestedEndMin = requestedStartMin + durationMinutes;

    for (const b of existing || []) {
      const existingStart = (b.booking_time as string).substring(0, 5);
      const [eh, em] = existingStart.split(':').map(Number);
      const existingStartMin = eh * 60 + em;
      const existingEndMin = existingStartMin + (b.duration_minutes || 30);
      if (requestedStartMin < existingEndMin && requestedEndMin > existingStartMin) {
        return NextResponse.json(
          { error: 'This time slot is no longer available. Please choose another time.' },
          { status: 409 }
        );
      }
    }

    // Create Google Calendar event with Meet link
    const { meetingLink, googleEventId, htmlLink: googleEventLink } = await createGoogleCalendarEventWithMeet({
      clientName,
      clientEmail,
      bookingDate,
      bookingTime,
      durationMinutes,
      notes,
    });

    // Insert booking
    const { data: booking, error: insertError } = await supabaseAdmin
      .from('consultation_bookings')
      .insert({
        client_name: clientName,
        client_email: clientEmail,
        booking_date: bookingDate,
        booking_time: bookingTime,
        duration_minutes: durationMinutes,
        notes: notes || null,
        inquiry_id: inquiryId || null,
        status: 'confirmed',
        meeting_location: meetingLink,
        confirmation_sent: false,
        ...(googleEventId ? { gcal_event_id: googleEventId } : {}),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Mark slot as taken in availability table
    await supabaseAdmin.from('consultation_availability_slots').insert({
      booking_date: bookingDate,
      booking_time: bookingTime,
      duration_mins: durationMinutes,
      is_blocked: false,
      booking_id: booking.id,
    }).on('conflict', () => {});

    // Build calendar add URLs
    const googleCalendarUrl = buildGoogleCalendarUrl({
      title: `Consultation — Broussard Legal Services`,
      startDate: bookingDate,
      startTime: bookingTime.substring(0, 5),
      durationMinutes,
      description: `Your ${durationMinutes}-minute paralegal consultation.\n\nJoin via Google Meet: ${meetingLink}`,
      location: meetingLink,
    });

    const icsDownloadUrl = `${SITE_URL}/api/consultations/calendar-invite?bookingId=${booking.id}`;

    // Send confirmation email via Gmail (Google Workspace)
    let emailSent = false;
    let emailError: string | null = null;

    {
      const durationLabel =
        durationMinutes === 15 ? '15-Min' : durationMinutes === 60 ? '60-Min' : '30-Min';
      const subject = `Consultation Confirmed — ${durationLabel} on ${formatDate(bookingDate)} at ${formatTime(bookingTime)} CST`;

      // Fetch any prep documents
      let prepDocuments: Array<{ fileName: string; publicUrl: string | null; description: string | null }> = [];
      if (inquiryId) {
        const { data: prepDocs } = await supabaseAdmin
          .from('consultation_prep_documents')
          .select('file_name, public_url, description')
          .eq('inquiry_id', inquiryId);
        if (prepDocs) {
          prepDocuments = prepDocs.map((d: { file_name: string; public_url: string | null; description: string | null }) => ({
            fileName: d.file_name,
            publicUrl: d.public_url,
            description: d.description,
          }));
        }
      }
      const { data: bookingPrepDocs } = await supabaseAdmin
        .from('consultation_prep_documents')
        .select('file_name, public_url, description')
        .eq('booking_id', booking.id);
      if (bookingPrepDocs) {
        const bookingDocSet = new Set(prepDocuments.map((d) => d.fileName));
        for (const d of bookingPrepDocs as Array<{ file_name: string; public_url: string | null; description: string | null }>) {
          if (!bookingDocSet.has(d.file_name)) {
            prepDocuments.push({ fileName: d.file_name, publicUrl: d.public_url, description: d.description });
          }
        }
      }

      const html = buildConfirmationEmail({
        clientName,
        clientEmail,
        bookingDate,
        bookingTime,
        durationMinutes,
        bookingId: booking.id,
        meetingLink,
        googleCalendarUrl,
        icsDownloadUrl,
        prepDocuments,
      });

      try {
        const result = await sendGmailEmail({
          to: clientEmail,
          subject,
          html,
          fromName: 'Broussard Legal Services',
        });

        if (result.success) {
          emailSent = true;
          await supabaseAdmin
            .from('consultation_bookings')
            .update({ confirmation_sent: true })
            .eq('id', booking.id);
        } else {
          emailError = result.error ?? 'Email send failed';
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Email send failed';
      }
    }

    // Schedule follow-up sequences
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      fetch(`${supabaseUrl}/functions/v1/schedule-contact-followup-sequence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          inquiryId: inquiryId || null,
          recipientEmail: clientEmail,
          recipientName: clientName,
          service: 'Legal Consultation',
          source: 'booking',
        }),
      }).catch(() => {});

      fetch(`${supabaseUrl}/functions/v1/schedule-consultation-24hr-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          clientEmail,
          clientName,
          bookingDate,
          bookingTime,
          durationMinutes,
          meetingLink,
        }),
      }).catch(() => {});
    }

    // Send SMS confirmation if phone provided and consent given
    if (clientPhone && smsConsent) {
      const tzShort = 'CT';
      const durationLabel =
        durationMinutes === 15 ? '15-Min' :
        durationMinutes === 60 ? '60-Min' : '30-Min';
      sendAppointmentConfirmationSMS({
        to: clientPhone,
        clientName,
        appointmentType: `${durationLabel} Paralegal Consultation`,
        appointmentDate: bookingDate,
        appointmentTime: bookingTime,
        timezone: 'America/Chicago',
      }).catch(() => { /* fire-and-forget */ });
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      meetingLink,
      googleEventId,
      googleEventLink,
      googleCalendarUrl,
      icsDownloadUrl,
      emailSent,
      emailError,
      booking: {
        id: booking.id,
        clientName,
        clientEmail,
        bookingDate,
        bookingTime,
        durationMinutes,
        status: 'confirmed',
        meetingLink,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create booking' },
      { status: 500 }
    );
  }
}
