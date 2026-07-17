/**
 * CourtListener / RECAP API Route
 * Free Law Project — real federal court opinions, PACER dockets, case citations
 * API docs: https://www.courtlistener.com/api/rest/v3/
 */

import { NextRequest, NextResponse } from 'next/server';

const COURTLISTENER_BASE = 'https://www.courtlistener.com/api/rest/v3';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, type = 'opinions', jurisdiction, dateAfter, dateBefore, limit = 5 } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      page_size: String(Math.min(limit, 20)),
      order_by: 'score desc',
    });

    if (jurisdiction) params.set('court', jurisdiction);
    if (dateAfter) params.set('filed_after', dateAfter);
    if (dateBefore) params.set('filed_before', dateBefore);

    // Search opinions (case law)
    const endpoint = type === 'dockets' ? 'dockets' : 'opinions';
    const url = `${COURTLISTENER_BASE}/search/?${params.toString()}&type=${type === 'dockets' ? 'r' : 'o'}`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BroussardLegalServices/1.0 (legal research tool)',
      },
      next: { revalidate: 3600 }, // cache 1 hour
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CourtListener API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const results = data?.results ?? [];

    const formatted = results.map((r: any) => ({
      id: r.id,
      caseName: r.caseName ?? r.case_name ?? '',
      citation: r.citation ?? r.citations?.[0] ?? '',
      court: r.court ?? r.court_id ?? '',
      dateFiled: r.dateFiled ?? r.date_filed ?? '',
      snippet: r.snippet ?? r.text?.slice(0, 300) ?? '',
      absoluteUrl: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : '',
      status: r.status ?? '',
      judges: r.judge ?? '',
    }));

    return NextResponse.json({
      source: 'CourtListener',
      query,
      count: data?.count ?? formatted.length,
      results: formatted,
    });
  } catch (err) {
    console.error('[CourtListener API]', err);
    return NextResponse.json({ error: 'CourtListener search failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const limit = parseInt(searchParams.get('limit') ?? '5');

  if (!query) return NextResponse.json({ error: 'q param required' }, { status: 400 });

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    page_size: String(Math.min(limit, 20)),
    order_by: 'score desc',
    type: 'o',
  });

  try {
    const res = await fetch(`${COURTLISTENER_BASE}/search/?${params.toString()}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'BroussardLegalServices/1.0' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json({ error: `API error ${res.status}` }, { status: res.status });

    const data = await res.json();
    return NextResponse.json({ source: 'CourtListener', results: data?.results ?? [], count: data?.count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: 'CourtListener fetch failed' }, { status: 500 });
  }
}
