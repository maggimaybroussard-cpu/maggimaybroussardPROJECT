/**
 * Congress.gov API Route for Lexi
 * Queries bills, legislation, congressional records, and federal statutes
 * in real time via the Congress.gov public API.
 */

import { NextRequest, NextResponse } from 'next/server';

const CONGRESS_BASE_URL = 'https://api.congress.gov/v3';

type CongressQueryType = 'bill' | 'amendment' | 'summaries' | 'congress' | 'member' | 'committee' | 'nomination' | 'treaty' | 'bound-congressional-record' | 'daily-congressional-record';

interface CongressSearchParams {
  query: string;
  type?: CongressQueryType;
  congress?: number;
  limit?: number;
  offset?: number;
  fromDateTime?: string;
  toDateTime?: string;
  sort?: 'updateDate+asc' | 'updateDate+desc';
}

async function fetchCongress(endpoint: string, params: Record<string, string | number> = {}) {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    throw new Error('CONGRESS_API_KEY is not configured');
  }

  const url = new URL(`${CONGRESS_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 }, // cache 5 minutes
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Congress.gov API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      type = 'bill',
      congress,
      limit = 10,
      offset = 0,
      sort = 'updateDate+desc',
    }: CongressSearchParams = body;

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Congress.gov API key not configured. Add CONGRESS_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    // Search bills/legislation
    const searchParams: Record<string, string | number> = {
      query,
      limit,
      offset,
      sort,
    };

    if (congress) {
      searchParams.congress = congress;
    }

    const endpoint = `/bill`;
    const data = await fetchCongress(endpoint, searchParams);

    const bills = (data?.bills ?? []).map((bill: any) => ({
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
      title: bill.title,
      originChamber: bill.originChamber,
      latestAction: bill.latestAction,
      updateDate: bill.updateDate,
      url: bill.url,
    }));

    return NextResponse.json({
      success: true,
      query,
      total: data?.pagination?.count ?? bills.length,
      bills,
      pagination: data?.pagination ?? null,
    });
  } catch (error) {
    console.error('[Congress API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to query Congress.gov',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const billType = searchParams.get('billType');
    const billNumber = searchParams.get('billNumber');
    const congress = searchParams.get('congress');

    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Congress.gov API key not configured.' },
        { status: 500 }
      );
    }

    // Fetch specific bill details
    if (billType && billNumber && congress) {
      const data = await fetchCongress(`/bill/${congress}/${billType.toLowerCase()}/${billNumber}`);
      return NextResponse.json({ success: true, bill: data?.bill ?? data });
    }

    // Fetch recent bills (default)
    const data = await fetchCongress('/bill', {
      limit: 20,
      sort: 'updateDate+desc',
    });

    return NextResponse.json({
      success: true,
      bills: data?.bills ?? [],
      pagination: data?.pagination ?? null,
    });
  } catch (error) {
    console.error('[Congress API] GET Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch from Congress.gov',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
