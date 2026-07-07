import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/leads/process-sequences
 *
 * Automated processor: finds all active nurture sequences and abandoned bookings
 * whose next_email_scheduled_at / next_follow_up_at is due, then triggers
 * AI-generated emails via /api/admin/leads/send-nurture-email for each one.
 *
 * Designed to be called by a cron job (e.g. Supabase pg_cron, Vercel Cron, or
 * an external scheduler) on a regular interval (e.g. every hour).
 *
 * Authorization: requires x-cron-secret header matching CRON_SECRET env var,
 * OR an authenticated admin session.
 */
export async function POST(request: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const cronSecret = request.headers.get('x-cron-secret');
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && cronSecret !== envSecret) {
    // Also allow authenticated admin calls
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
  const now = new Date().toISOString();
  const results: { type: string; id: string; email: string; status: string; error?: string }[] = [];

  try {
    const supabase = await createClient();

    // ── 1. Fetch due nurture sequences ─────────────────────────────────────────
    const { data: dueNurture } = await supabase
      .from('lead_nurture_sequences')
      .select('*')
      .eq('sequence_status', 'active')
      .lte('next_email_scheduled_at', now)
      .not('next_email_scheduled_at', 'is', null)
      .limit(50);

    // ── 2. Fetch due abandoned booking follow-ups ──────────────────────────────
    const { data: dueAbandoned } = await supabase
      .from('abandoned_booking_sequences')
      .select('*')
      .eq('sequence_status', 'active')
      .lte('next_follow_up_at', now)
      .not('next_follow_up_at', 'is', null)
      .is('recovered_at', null)
      .limit(50);

    // ── 3. Process nurture sequences ───────────────────────────────────────────
    for (const seq of dueNurture ?? []) {
      try {
        const res = await fetch(`${siteUrl}/api/admin/leads/send-nurture-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequenceId: seq.id,
            sequenceType: 'nurture',
            name: seq.name,
            email: seq.email,
            leadScore: seq.lead_score,
            scoreTier: seq.score_tier,
            triggerType: seq.trigger_type,
            serviceInterest: seq.conversion_type,
            currentStep: seq.current_step,
            totalSteps: seq.total_steps,
            lastEmailSentAt: seq.last_email_sent_at,
            conversionType: seq.conversion_type,
          }),
        });

        const data = await res.json();
        results.push({
          type: 'nurture',
          id: seq.id,
          email: seq.email,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? undefined : data.error,
        });
      } catch (e) {
        results.push({
          type: 'nurture',
          id: seq.id,
          email: seq.email,
          status: 'failed',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    // ── 4. Process abandoned booking follow-ups ────────────────────────────────
    for (const ab of dueAbandoned ?? []) {
      // Stop after 5 follow-ups for abandoned bookings
      if (ab.follow_up_count >= 5) {
        await supabase
          .from('abandoned_booking_sequences')
          .update({ sequence_status: 'completed', next_follow_up_at: null })
          .eq('id', ab.id);
        results.push({ type: 'abandoned', id: ab.id, email: ab.email, status: 'completed_max_followups' });
        continue;
      }

      try {
        const scoreTier =
          ab.lead_score >= 70 ? 'hot' : ab.lead_score >= 45 ? 'warm' : 'cold';

        const res = await fetch(`${siteUrl}/api/admin/leads/send-nurture-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequenceId: ab.id,
            sequenceType: 'abandoned',
            name: ab.name,
            email: ab.email,
            leadScore: ab.lead_score,
            scoreTier,
            triggerType: 'abandoned_booking',
            serviceInterest: ab.service_interest,
            followUpCount: ab.follow_up_count,
            lastEmailSentAt: ab.last_follow_up_at,
          }),
        });

        const data = await res.json();
        results.push({
          type: 'abandoned',
          id: ab.id,
          email: ab.email,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? undefined : data.error,
        });
      } catch (e) {
        results.push({
          type: 'abandoned',
          id: ab.id,
          email: ab.email,
          status: 'failed',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      sent,
      failed,
      results,
      processedAt: now,
    });
  } catch (error) {
    console.error('Process sequences error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process sequences' },
      { status: 500 }
    );
  }
}

/**
 * GET — returns pending counts without processing (useful for admin dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    const [nurtureRes, abandonedRes] = await Promise.allSettled([
      supabase
        .from('lead_nurture_sequences')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_status', 'active')
        .lte('next_email_scheduled_at', now)
        .not('next_email_scheduled_at', 'is', null),
      supabase
        .from('abandoned_booking_sequences')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_status', 'active')
        .lte('next_follow_up_at', now)
        .not('next_follow_up_at', 'is', null)
        .is('recovered_at', null),
    ]);

    return NextResponse.json({
      pendingNurture: nurtureRes.status === 'fulfilled' ? (nurtureRes.value.count ?? 0) : 0,
      pendingAbandoned: abandonedRes.status === 'fulfilled' ? (abandonedRes.value.count ?? 0) : 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pending counts' },
      { status: 500 }
    );
  }
}
