/**
 * Google Scholar Case Law API Route
 * Searches Google Scholar's free case law database via structured URL scraping
 * Note: Google Scholar doesn't have an official API — this uses their public search URLs
 * For production, consider CourtListener (already integrated) as the primary source
 */

import { NextRequest, NextResponse } from 'next/server';

// Google Scholar case law search URL builder
function buildGoogleScholarUrl(query: string, court?: string, dateAfter?: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: 'en',
    as_sdt: '4', // case law only
    as_vis: '1',
  });

  if (court) params.set('as_sdt', `4,${court}`);
  if (dateAfter) params.set('as_ylo', dateAfter);

  return `https://scholar.google.com/scholar?${params.toString()}`;
}

// Justia case law search (has structured URLs)
function buildJustiaUrl(query: string, jurisdiction?: string): string {
  const encoded = encodeURIComponent(query);
  if (jurisdiction) {
    return `https://law.justia.com/cases/${jurisdiction.toLowerCase()}/?q=${encoded}`;
  }
  return `https://law.justia.com/cases/?q=${encoded}`;
}

// Cornell LII search URL
function buildCornellLIIUrl(query: string): string {
  return `https://www.law.cornell.edu/search/site/${encodeURIComponent(query)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, jurisdiction, dateAfter, sources = ['google_scholar', 'justia', 'cornell_lii'] } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // Build search URLs for each source
    const searchLinks: Array<{ source: string; url: string; description: string }> = [];

    if (sources.includes('google_scholar')) {
      searchLinks.push({
        source: 'Google Scholar',
        url: buildGoogleScholarUrl(query.trim(), jurisdiction, dateAfter),
        description: 'Free case law search — federal and state court opinions',
      });
    }

    if (sources.includes('justia')) {
      searchLinks.push({
        source: 'Justia',
        url: buildJustiaUrl(query.trim(), jurisdiction),
        description: 'Free case law, U.S. Code, CFR, and state statutes',
      });
    }

    if (sources.includes('cornell_lii')) {
      searchLinks.push({
        source: 'Cornell LII',
        url: buildCornellLIIUrl(query.trim()),
        description: 'Legal Information Institute — U.S. Code, CFR, Constitution, and case law',
      });
    }

    // Also include CourtListener for actual API results
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    let courtListenerResults: any[] = [];

    try {
      const clRes = await fetch(`${baseUrl}/api/lexi/courtlistener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 5 }),
      });

      if (clRes.ok) {
        const clData = await clRes.json();
        courtListenerResults = clData?.results ?? [];
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      source: 'Google Scholar / Justia / Cornell LII',
      query,
      searchLinks,
      courtListenerResults,
      note: 'Google Scholar and Justia do not provide a public API. Use the search links to access case law directly, or use CourtListener results above for programmatic access.',
    });
  } catch (err) {
    console.error('[Google Scholar / Justia / LII API]', err);
    return NextResponse.json({ error: 'Case law search failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const jurisdiction = searchParams.get('jurisdiction') ?? '';

  if (!query) return NextResponse.json({ error: 'q param required' }, { status: 400 });

  return NextResponse.json({
    source: 'Google Scholar / Justia / Cornell LII',
    query,
    searchLinks: [
      { source: 'Google Scholar', url: buildGoogleScholarUrl(query, jurisdiction || undefined) },
      { source: 'Justia', url: buildJustiaUrl(query, jurisdiction || undefined) },
      { source: 'Cornell LII', url: buildCornellLIIUrl(query) },
    ],
  });
}
