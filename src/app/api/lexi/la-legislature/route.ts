/**
 * Louisiana Legislature API Route
 * Source: https://legis.la.gov/legis/API/
 * Tracks live Louisiana bills, session data, and legislative activity
 */

import { NextRequest, NextResponse } from 'next/server';

const LA_LEGIS_BASE = 'https://legis.la.gov/legis/API';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, session, billType, billNumber, author } = body;

    // Get current sessions list
    if (!session && !query && !billNumber) {
      const sessRes = await fetch(`${LA_LEGIS_BASE}/Sessions/`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 86400 },
      });

      if (sessRes.ok) {
        const sessions = await sessRes.json();
        return NextResponse.json({ source: 'Louisiana Legislature', sessions });
      }
    }

    // Search bills by keyword
    if (query?.trim()) {
      const params = new URLSearchParams({
        keyword: query.trim(),
      });
      if (session) params.set('sessionId', session);
      if (billType) params.set('billType', billType);
      if (author) params.set('author', author);

      const res = await fetch(`${LA_LEGIS_BASE}/BillSearch/?${params.toString()}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 1800 },
      });

      if (!res.ok) {
        // Fallback: try OpenStates for Louisiana
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
        const fallbackRes = await fetch(`${baseUrl}/api/lexi/openstates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, state: 'LA', limit: 10 }),
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          return NextResponse.json({
            source: 'OpenStates (Louisiana fallback)',
            ...fallbackData,
          });
        }

        return NextResponse.json(
          { error: `Louisiana Legislature API error: ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const bills = Array.isArray(data) ? data : data?.Bills ?? data?.bills ?? [];

      const formatted = bills.map((b: any) => ({
        billId: b.BillId ?? b.billId ?? '',
        billNumber: b.BillNumber ?? b.billNumber ?? '',
        billType: b.BillType ?? b.billType ?? '',
        session: b.SessionId ?? b.session ?? '',
        title: b.Title ?? b.title ?? b.ShortTitle ?? '',
        author: b.Author ?? b.author ?? '',
        status: b.LastAction ?? b.status ?? '',
        statusDate: b.LastActionDate ?? b.statusDate ?? '',
        url: b.BillId
          ? `https://legis.la.gov/legis/BillInfo.aspx?i=${b.BillId}`
          : '',
      }));

      return NextResponse.json({
        source: 'Louisiana Legislature',
        query,
        count: formatted.length,
        bills: formatted,
      });
    }

    // Fetch specific bill by number
    if (billNumber && session) {
      const res = await fetch(
        `${LA_LEGIS_BASE}/BillSearch/?billNumber=${billNumber}&sessionId=${session}`,
        { headers: { 'Accept': 'application/json' }, next: { revalidate: 1800 } }
      );

      if (!res.ok) {
        return NextResponse.json({ error: `Bill fetch error: ${res.status}` }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({ source: 'Louisiana Legislature', data });
    }

    return NextResponse.json({ error: 'Provide query, billNumber+session, or leave empty for sessions list' }, { status: 400 });
  } catch (err) {
    console.error('[Louisiana Legislature API]', err);
    return NextResponse.json({ error: 'Louisiana Legislature request failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const session = searchParams.get('session') ?? '';

  if (!query) return NextResponse.json({ error: 'q param required' }, { status: 400 });

  try {
    const params = new URLSearchParams({ keyword: query });
    if (session) params.set('sessionId', session);

    const res = await fetch(`${LA_LEGIS_BASE}/BillSearch/?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 1800 },
    });

    if (!res.ok) return NextResponse.json({ error: `LA Legis error ${res.status}` }, { status: res.status });

    const data = await res.json();
    return NextResponse.json({ source: 'Louisiana Legislature', results: data });
  } catch (err) {
    return NextResponse.json({ error: 'Louisiana Legislature fetch failed' }, { status: 500 });
  }
}
