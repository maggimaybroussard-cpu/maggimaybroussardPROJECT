/**
 * eCFR API Route — Live Code of Federal Regulations
 * Source: https://www.ecfr.gov/api/versioner/v1/
 * Free, no API key required
 */

import { NextRequest, NextResponse } from 'next/server';

const ECFR_BASE = 'https://www.ecfr.gov/api';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, title, part, section } = body;

    if (!query?.trim() && !title) {
      return NextResponse.json({ error: 'query or title is required' }, { status: 400 });
    }

    // Full-text search across eCFR
    if (query?.trim()) {
      const params = new URLSearchParams({
        query: query.trim(),
        per_page: '10',
        page: '1',
      });
      if (title) params.set('title', String(title));

      const searchRes = await fetch(`${ECFR_BASE}/search/v1/results?${params.toString()}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      });

      if (!searchRes.ok) {
        return NextResponse.json({ error: `eCFR search error: ${searchRes.status}` }, { status: searchRes.status });
      }

      const searchData = await searchRes.json();
      const results = (searchData?.results ?? []).map((r: any) => ({
        title: r.title ?? '',
        part: r.part ?? '',
        section: r.section ?? '',
        subject: r.subject ?? '',
        snippet: r.snippet ?? '',
        citation: `${r.title ? `${r.title} C.F.R.` : 'C.F.R.'} § ${r.part ?? ''}${r.section ? `.${r.section}` : ''}`,
        url: r.full_text_excerpt_url ?? `https://www.ecfr.gov/current/title-${r.title}/part-${r.part}`,
      }));

      return NextResponse.json({
        source: 'eCFR',
        query,
        count: searchData?.meta?.total_count ?? results.length,
        results,
      });
    }

    // Fetch specific CFR title/part/section
    if (title && part) {
      const date = new Date().toISOString().split('T')[0];
      let url = `${ECFR_BASE}/versioner/v1/full/${date}/title-${title}.json?part=${part}`;
      if (section) url += `&section=${section}`;

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        return NextResponse.json({ error: `eCFR fetch error: ${res.status}` }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({
        source: 'eCFR',
        citation: `${title} C.F.R. Part ${part}${section ? ` § ${section}` : ''}`,
        data,
      });
    }

    return NextResponse.json({ error: 'Provide query or title+part' }, { status: 400 });
  } catch (err) {
    console.error('[eCFR API]', err);
    return NextResponse.json({ error: 'eCFR request failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';

  if (!query) return NextResponse.json({ error: 'q param required' }, { status: 400 });

  try {
    const res = await fetch(
      `${ECFR_BASE}/search/v1/results?query=${encodeURIComponent(query)}&per_page=10`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 3600 } }
    );

    if (!res.ok) return NextResponse.json({ error: `eCFR error ${res.status}` }, { status: res.status });

    const data = await res.json();
    return NextResponse.json({ source: 'eCFR', results: data?.results ?? [], count: data?.meta?.total_count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: 'eCFR fetch failed' }, { status: 500 });
  }
}
