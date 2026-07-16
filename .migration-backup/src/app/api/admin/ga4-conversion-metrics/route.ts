import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Total inquiries
    const { count: totalInquiries } = await supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true });

    // Inquiries that became cases (booking_stage progressed past 'inquiry')
    const { count: inquiriesToCases } = await supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .not('booking_stage', 'eq', 'inquiry')
      .not('booking_stage', 'is', null);

    // Inquiries that have an associated appointment (via calendly_bookings or lexi_appointments)
    const { count: inquiriesToAppointments } = await supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .in('booking_stage', ['consultation', 'proposal', 'active', 'closed', 'pending_payment']);

    // Inquiries that resulted in a payment
    const { count: inquiriesToPayments } = await supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .in('booking_stage', ['active', 'closed', 'pending_payment']);

    // Revenue by service type from client_invoices
    const { data: invoiceData } = await supabase
      .from('client_invoices')
      .select('service_type, amount_paid, payment_status')
      .eq('payment_status', 'paid');

    const revenueMap: Record<string, { revenue: number; count: number }> = {};
    (invoiceData ?? []).forEach((inv: { service_type: string | null; amount_paid: number | null }) => {
      const svc = inv.service_type || 'General';
      if (!revenueMap[svc]) revenueMap[svc] = { revenue: 0, count: 0 };
      revenueMap[svc].revenue += inv.amount_paid ?? 0;
      revenueMap[svc].count += 1;
    });

    const revenueByService = Object.entries(revenueMap)
      .map(([service, d]) => ({ service, revenue: Math.round(d.revenue), count: d.count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Lead sources from contact_inquiries
    const { data: inquiryData } = await supabase
      .from('contact_inquiries')
      .select('lead_source, booking_stage, status');

    const sourceMap: Record<string, { count: number; converted: number }> = {};
    (inquiryData ?? []).forEach((inq: { lead_source: string | null; booking_stage: string | null; status: string | null }) => {
      const src = inq.lead_source || 'direct';
      if (!sourceMap[src]) sourceMap[src] = { count: 0, converted: 0 };
      sourceMap[src].count += 1;
      if (inq.booking_stage && inq.booking_stage !== 'inquiry') {
        sourceMap[src].converted += 1;
      }
    });

    const leadSources = Object.entries(sourceMap)
      .map(([source, d]) => ({ source, count: d.count, converted: d.converted }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Pipeline stage breakdown
    const stageGroups: Record<string, number[]> = {};
    (inquiryData ?? []).forEach((inq: { booking_stage: string | null }) => {
      const stage = inq.booking_stage || 'inquiry';
      if (!stageGroups[stage]) stageGroups[stage] = [];
      stageGroups[stage].push(1);
    });

    // Get avg days in stage from updated_at vs created_at
    const { data: stageTimingData } = await supabase
      .from('contact_inquiries')
      .select('booking_stage, created_at, updated_at');

    const stageTiming: Record<string, number[]> = {};
    (stageTimingData ?? []).forEach((row: { booking_stage: string | null; created_at: string; updated_at: string }) => {
      const stage = row.booking_stage || 'inquiry';
      const created = new Date(row.created_at).getTime();
      const updated = new Date(row.updated_at || row.created_at).getTime();
      const days = Math.round((updated - created) / (1000 * 60 * 60 * 24));
      if (!stageTiming[stage]) stageTiming[stage] = [];
      stageTiming[stage].push(days);
    });

    const STAGE_ORDER = ['inquiry', 'consultation', 'proposal', 'active', 'pending_payment', 'closed'];
    const pipelineStages = STAGE_ORDER.map((stage) => {
      const timings = stageTiming[stage] ?? [];
      const avgDays = timings.length > 0 ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : 0;
      return {
        stage,
        count: stageGroups[stage]?.length ?? 0,
        avgDaysInStage: avgDays,
      };
    }).filter((s) => s.count > 0);

    return NextResponse.json({
      totalInquiries: totalInquiries ?? 0,
      inquiriesToCases: inquiriesToCases ?? 0,
      inquiriesToAppointments: inquiriesToAppointments ?? 0,
      inquiriesToPayments: inquiriesToPayments ?? 0,
      revenueByService,
      leadSources,
      pipelineStages,
    });
  } catch (err) {
    console.error('GA4 conversion metrics error:', err);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
