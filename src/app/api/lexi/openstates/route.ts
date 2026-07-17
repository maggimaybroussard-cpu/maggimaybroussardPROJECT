/**
 * OpenStates API Route — Real-time state bill tracking across all 50 states
 * API docs: https://v3.openstates.org/docs
 * Requires OPENSTATES_API_KEY env variable (free tier available)
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENSTATES_BASE = 'https://v3.openstates.org';

// State abbreviation to OpenStates jurisdiction ID mapping
const STATE_JURISDICTION_MAP: Record<string, string> = {
  AL: 'ocd-jurisdiction/country:us/state:al/government',
  AK: 'ocd-jurisdiction/country:us/state:ak/government',
  AZ: 'ocd-jurisdiction/country:us/state:az/government',
  AR: 'ocd-jurisdiction/country:us/state:ar/government',
  CA: 'ocd-jurisdiction/country:us/state:ca/government',
  CO: 'ocd-jurisdiction/country:us/state:co/government',
  CT: 'ocd-jurisdiction/country:us/state:ct/government',
  DE: 'ocd-jurisdiction/country:us/state:de/government',
  FL: 'ocd-jurisdiction/country:us/state:fl/government',
  GA: 'ocd-jurisdiction/country:us/state:ga/government',
  HI: 'ocd-jurisdiction/country:us/state:hi/government',
  ID: 'ocd-jurisdiction/country:us/state:id/government',
  IL: 'ocd-jurisdiction/country:us/state:il/government',
  IN: 'ocd-jurisdiction/country:us/state:in/government',
  IA: 'ocd-jurisdiction/country:us/state:ia/government',
  KS: 'ocd-jurisdiction/country:us/state:ks/government',
  KY: 'ocd-jurisdiction/country:us/state:ky/government',
  LA: 'ocd-jurisdiction/country:us/state:la/government',
  ME: 'ocd-jurisdiction/country:us/state:me/government',
  MD: 'ocd-jurisdiction/country:us/state:md/government',
  MA: 'ocd-jurisdiction/country:us/state:ma/government',
  MI: 'ocd-jurisdiction/country:us/state:mi/government',
  MN: 'ocd-jurisdiction/country:us/state:mn/government',
  MS: 'ocd-jurisdiction/country:us/state:ms/government',
  MO: 'ocd-jurisdiction/country:us/state:mo/government',
  MT: 'ocd-jurisdiction/country:us/state:mt/government',
  NE: 'ocd-jurisdiction/country:us/state:ne/government',
  NV: 'ocd-jurisdiction/country:us/state:nv/government',
  NH: 'ocd-jurisdiction/country:us/state:nh/government',
  NJ: 'ocd-jurisdiction/country:us/state:nj/government',
  NM: 'ocd-jurisdiction/country:us/state:nm/government',
  NY: 'ocd-jurisdiction/country:us/state:ny/government',
  NC: 'ocd-jurisdiction/country:us/state:nc/government',
  ND: 'ocd-jurisdiction/country:us/state:nd/government',
  OH: 'ocd-jurisdiction/country:us/state:oh/government',
  OK: 'ocd-jurisdiction/country:us/state:ok/government',
  OR: 'ocd-jurisdiction/country:us/state:or/government',
  PA: 'ocd-jurisdiction/country:us/state:pa/government',
  RI: 'ocd-jurisdiction/country:us/state:ri/government',
  SC: 'ocd-jurisdiction/country:us/state:sc/government',
  SD: 'ocd-jurisdiction/country:us/state:sd/government',
  TN: 'ocd-jurisdiction/country:us/state:tn/government',
  TX: 'ocd-jurisdiction/country:us/state:tx/government',
  UT: 'ocd-jurisdiction/country:us/state:ut/government',
  VT: 'ocd-jurisdiction/country:us/state:vt/government',
  VA: 'ocd-jurisdiction/country:us/state:va/government',
  WA: 'ocd-jurisdiction/country:us/state:wa/government',
  WV: 'ocd-jurisdiction/country:us/state:wv/government',
  WI: 'ocd-jurisdiction/country:us/state:wi/government',
  WY: 'ocd-jurisdiction/country:us/state:wy/government',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, state, session, status, limit = 10 } = body;

    const apiKey = process.env.OPENSTATES_API_KEY;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (apiKey) headers['X-API-KEY'] = apiKey;

    const params = new URLSearchParams({
      per_page: String(Math.min(limit, 20)),
      page: '1',
    });

    if (query?.trim()) params.set('q', query.trim());
    if (state) {
      const jurisdiction = STATE_JURISDICTION_MAP[state.toUpperCase()];
      if (jurisdiction) params.set('jurisdiction', jurisdiction);
    }
    if (session) params.set('session', session);
    if (status) params.set('status', status);

    const res = await fetch(`${OPENSTATES_BASE}/bills?${params.toString()}`, {
      headers,
      next: { revalidate: 1800 }, // cache 30 min
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `OpenStates API error: ${res.status}`, detail: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    const bills = (data?.results ?? []).map((b: any) => ({
      id: b.id,
      identifier: b.identifier ?? '',
      title: b.title ?? '',
      state: b.jurisdiction?.name ?? state ?? '',
      session: b.session ?? '',
      status: b.latest_action_description ?? '',
      statusDate: b.latest_action_date ?? '',
      subjects: b.subject ?? [],
      url: b.openstates_url ?? '',
      sponsors: (b.sponsorships ?? []).map((s: any) => s.name).slice(0, 3),
    }));

    return NextResponse.json({
      source: 'OpenStates',
      query,
      state,
      count: data?.pagination?.total_items ?? bills.length,
      bills,
    });
  } catch (err) {
    console.error('[OpenStates API]', err);
    return NextResponse.json({ error: 'OpenStates request failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const state = searchParams.get('state') ?? '';

  if (!query && !state) return NextResponse.json({ error: 'q or state param required' }, { status: 400 });

  const apiKey = process.env.OPENSTATES_API_KEY;
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) headers['X-API-KEY'] = apiKey;

  const params = new URLSearchParams({ per_page: '10', page: '1' });
  if (query) params.set('q', query);
  if (state) {
    const jurisdiction = STATE_JURISDICTION_MAP[state.toUpperCase()];
    if (jurisdiction) params.set('jurisdiction', jurisdiction);
  }

  try {
    const res = await fetch(`${OPENSTATES_BASE}/bills?${params.toString()}`, {
      headers,
      next: { revalidate: 1800 },
    });

    if (!res.ok) return NextResponse.json({ error: `OpenStates error ${res.status}` }, { status: res.status });

    const data = await res.json();
    return NextResponse.json({ source: 'OpenStates', results: data?.results ?? [], count: data?.pagination?.total_items ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: 'OpenStates fetch failed' }, { status: 500 });
  }
}
