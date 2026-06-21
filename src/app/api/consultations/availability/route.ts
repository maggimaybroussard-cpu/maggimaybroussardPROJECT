import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// All possible time slots (9am–5pm, 30-min increments)
const ALL_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
];

function slotsBlockedByDuration(startTime: string, durationMins: number): string[] {
  const [h, m] = startTime.split(':').map(Number);
  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + durationMins;
  return ALL_SLOTS.filter((slot) => {
    const [sh, sm] = slot.split(':').map(Number);
    const slotMinutes = sh * 60 + sm;
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  });
}

// GET /api/consultations/availability?date=YYYY-MM-DD&duration=30
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '30', 10);

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Fetch all bookings on this date
    const { data: bookings, error } = await supabaseAdmin
      .from('consultation_bookings')
      .select('booking_time, duration_minutes')
      .eq('booking_date', date)
      .not('status', 'eq', 'cancelled');

    if (error) throw error;

    // Build set of blocked time slots
    const blockedSlots = new Set<string>();
    for (const booking of bookings || []) {
      const timeStr = (booking.booking_time as string).substring(0, 5); // HH:MM
      const dur = booking.duration_minutes || 30;
      slotsBlockedByDuration(timeStr, dur).forEach((s) => blockedSlots.add(s));
    }

    // Also check manual blocks
    const { data: manualBlocks } = await supabaseAdmin
      .from('consultation_availability_slots')
      .select('booking_time, duration_mins')
      .eq('booking_date', date)
      .eq('is_blocked', true);

    for (const block of manualBlocks || []) {
      const timeStr = (block.booking_time as string).substring(0, 5);
      slotsBlockedByDuration(timeStr, block.duration_mins || 30).forEach((s) =>
        blockedSlots.add(s)
      );
    }

    // Build availability: a slot is available if it and all slots needed for the duration are free
    const available = ALL_SLOTS.filter((slot) => {
      const needed = slotsBlockedByDuration(slot, duration);
      return needed.every((s) => !blockedSlots.has(s));
    });

    return NextResponse.json({ date, duration, available, blocked: Array.from(blockedSlots) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
