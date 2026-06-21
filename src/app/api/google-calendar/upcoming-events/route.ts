import { NextResponse } from 'next/server';
import { fetchUpcomingCalendarEvents } from '@/lib/googleCalendar';

/**
 * GET /api/google-calendar/upcoming-events
 * Returns upcoming events from the connected Google Calendar.
 */
export async function GET() {
  try {
    const events = await fetchUpcomingCalendarEvents(30);
    return NextResponse?.json({ events });
  } catch (err) {
    return NextResponse?.json(
      { error: err instanceof Error ? err?.message : 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
