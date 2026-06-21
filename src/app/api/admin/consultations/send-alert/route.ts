import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  sendConsultationAlertEmail,
  type ConsultationAlertType,
} from '@/lib/email/consultationAlertEmails';

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

const ALERT_NOTIFICATION_TITLES: Record<ConsultationAlertType, string> = {
  confirmed: 'Consultation Confirmed',
  rescheduled: 'Consultation Rescheduled',
  completed: 'Consultation Completed',
};

const ALERT_NOTIFICATION_BODIES: Record<ConsultationAlertType, (date: string, time: string) => string> = {
  confirmed: (date, time) => `Your consultation is confirmed for ${date} at ${time}.`,
  rescheduled: (date, time) => `Your consultation has been rescheduled to ${date} at ${time}.`,
  completed: () => 'Thank you for your consultation. We look forward to assisting you further.',
};

/**
 * POST /api/admin/consultations/send-alert
 * Body: {
 *   consultationId: string,
 *   alertType: 'confirmed' | 'rescheduled' | 'completed',
 *   clientEmail: string,
 *   clientName: string,
 *   bookingDate: string,
 *   bookingTime: string,
 *   bookingType: string,
 *   meetingLocation?: string,
 *   notes?: string,
 *   userId?: string,       // portal user_id for in-app notification
 *   inquiryId?: string,    // contact_inquiries.id for in-app notification
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      consultationId,
      alertType,
      clientEmail,
      clientName,
      bookingDate,
      bookingTime,
      bookingType,
      meetingLocation,
      notes,
      userId,
      inquiryId,
    } = body as {
      consultationId?: string;
      alertType: ConsultationAlertType;
      clientEmail: string;
      clientName: string;
      bookingDate: string;
      bookingTime: string;
      bookingType: string;
      meetingLocation?: string;
      notes?: string;
      userId?: string;
      inquiryId?: string;
    };

    if (!alertType || !clientEmail || !clientName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { error: 'Missing required fields: alertType, clientEmail, clientName, bookingDate, bookingTime' },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY ?? '';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

    // 1. Send email via Resend
    const emailResult = await sendConsultationAlertEmail({
      resendApiKey,
      clientEmail,
      clientName,
      alertType,
      bookingDate,
      bookingTime,
      bookingType,
      meetingLocation,
      notes,
      portalLink: `${siteUrl}/portal/dashboard`,
    });

    // 2. Insert in-app notification (admin audience always; client audience if userId present)
    const supabase = createClient();
    const notifTitle = ALERT_NOTIFICATION_TITLES[alertType];
    const notifBody = ALERT_NOTIFICATION_BODIES[alertType](bookingDate, bookingTime);

    const notificationsToInsert = [];

    // Admin notification
    notificationsToInsert.push({
      audience: 'admin',
      user_id: null,
      inquiry_id: inquiryId ?? null,
      notification_type: 'system',
      title: `${notifTitle} — ${clientName}`,
      body: `${notifBody} Email ${emailResult.sent ? 'sent' : 'failed'}.`,
      link: '/admin?tab=consultations',
      metadata: {
        consultation_id: consultationId ?? null,
        alert_type: alertType,
        client_email: clientEmail,
        email_sent: emailResult.sent,
      },
    });

    // Client in-app notification (if portal user_id is known)
    if (userId) {
      notificationsToInsert.push({
        audience: 'client',
        user_id: userId,
        inquiry_id: inquiryId ?? null,
        notification_type: 'system',
        title: notifTitle,
        body: notifBody,
        link: '/portal/dashboard',
        metadata: {
          consultation_id: consultationId ?? null,
          alert_type: alertType,
        },
      });
    }

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationsToInsert);

    return NextResponse.json({
      success: true,
      emailSent: emailResult.sent,
      emailError: emailResult.error ?? null,
      notificationInserted: !notifError,
      notificationError: notifError?.message ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send consultation alert' },
      { status: 500 }
    );
  }
}
