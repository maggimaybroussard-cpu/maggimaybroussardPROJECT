/**
 * GovInfo API Route — U.S. Government Publishing Office
 * Source: https://api.govinfo.gov/
 * Provides: Federal Register, Congressional Record, U.S. Code, CFR, Statutes at Large
 * Requires GOVINFO_API_KEY (free, register at api.govinfo.gov)
 */

import { NextRequest, NextResponse } from 'next/server';

const GOVINFO_BASE = 'https://api.govinfo.gov';

// Collection IDs for common legal sources
const COLLECTIONS: Record<string, string> = {
  'federal-register': 'FR',
  'us-code': 'USCODE',
  'cfr': 'CFR',
  'congressional-record': 'CREC',
  'statutes-at-large': 'STATUTE',
  'public-laws': 'PLAW',
  'bills': 'BILLS',
  'court-opinions': 'USCOURTS',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, collection = 'all', dateAfter, dateBefore, limit = 10 } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const apiKey = process.env.GOVINFO_API_KEY ?? 'DEMO_KEY';

    const params = new URLSearchParams({
      query: query.trim(),
      pageSize: String(Math.min(limit, 20)),
      offsetMark: '*',
      api_key: apiKey,
    });

    if (collection !== 'all' && COLLECTIONS[collection]) {
      params.set('collection', COLLECTIONS[collection]);
    }
    if (dateAfter) params.set('startDate', dateAfter);
    if (dateBefore) params.set('endDate', dateBefore);

    const res = await fetch(`${GOVINFO_BASE}/search?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GovInfo API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const results = (data?.results ?? []).map((r: any) => ({
      packageId: r.packageId ?? '',
      title: r.title ?? '',
      collection: r.collectionCode ?? '',
      dateIssued: r.dateIssued ?? '',
      congress: r.congress ?? '',
      session: r.session ?? '',
      citation: r.citation ?? '',
      url: r.detailsLink ?? `https://www.govinfo.gov/content/pkg/${r.packageId}/pdf/${r.packageId}.pdf`,
      download: r.download?.pdfLink ?? '',
    }));

    return NextResponse.json({
      source: 'GovInfo (U.S. GPO)',
      query,
      count: data?.count ?? results.length,
      results,
    });
  } catch (err) {
    console.error('[GovInfo API]', err);
    return NextResponse.json({ error: 'GovInfo request failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const collection = searchParams.get('collection') ?? 'all';

  if (!query) return NextResponse.json({ error: 'q param required' }, { status: 400 });

  const apiKey = process.env.GOVINFO_API_KEY ?? 'DEMO_KEY';

  const params = new URLSearchParams({
    query,
    pageSize: '10',
    offsetMark: '*',
    api_key: apiKey,
  });

  if (collection !== 'all' && COLLECTIONS[collection]) {
    params.set('collection', COLLECTIONS[collection]);
  }

  try {
    const res = await fetch(`${GOVINFO_BASE}/search?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json({ error: `GovInfo error ${res.status}` }, { status: res.status });

    const data = await res.json();
    return NextResponse.json({ source: 'GovInfo', results: data?.results ?? [], count: data?.count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: 'GovInfo fetch failed' }, { status: 500 });
  }
}
