/**
 * Conflict of Interest Check — Airtable CRM lookup
 * Cross-references the Airtable Lexi Leads CRM for name/email/firm matches
 */

import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = 'app6Tk6mUPY4K4ydc';
const AIRTABLE_TABLE_ID = 'tblhotvinu6Jz2wxZ';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

interface ConflictMatch {
  source: 'airtable';
  name: string;
  email?: string;
  firm?: string;
  matchType: 'exact' | 'partial';
  details?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ matches: [] });
  }

  let body: { name?: string; email?: string; firm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name = '', email = '', firm = '' } = body;
  if (!name.trim()) {
    return NextResponse.json({ matches: [] });
  }

  try {
    // Build Airtable filter formula
    const filters: string[] = [];
    if (name.trim()) {
      filters.push(`SEARCH(LOWER("${name.trim().replace(/"/g, '\"')}"), LOWER({Name}))`);
    }
    if (email.trim()) {
      filters.push(`LOWER({Email}) = LOWER("${email.trim().replace(/"/g, '\"')}")`);
    }

    const formula = filters.length > 1 ? `OR(${filters.join(',')})` : filters[0] ?? 'FALSE()';

    const url = new URL(AIRTABLE_API_URL);
    url.searchParams.set('filterByFormula', formula);
    url.searchParams.set('maxRecords', '20');
    url.searchParams.set('fields[]', 'Name');
    url.searchParams.set('fields[]', 'Email');
    url.searchParams.set('fields[]', 'Service Type');
    url.searchParams.set('fields[]', 'Status');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return NextResponse.json({ matches: [] });
    }

    const data = await res.json();
    const matches: ConflictMatch[] = (data.records ?? []).map((record: { fields: Record<string, string> }) => {
      const fields = record.fields;
      const recordName = fields['Name'] ?? '';
      const recordEmail = fields['Email'] ?? '';
      const isExact =
        recordName.toLowerCase() === name.trim().toLowerCase() ||
        (email && recordEmail.toLowerCase() === email.trim().toLowerCase());

      return {
        source: 'airtable' as const,
        name: recordName,
        email: recordEmail || undefined,
        matchType: isExact ? 'exact' : 'partial',
        details: `Airtable CRM — Service: ${fields['Service Type'] ?? 'N/A'}, Status: ${fields['Status'] ?? 'N/A'}`,
      };
    });

    return NextResponse.json({ matches });
  } catch (err) {
    console.error('[conflict-check] Airtable error:', err);
    return NextResponse.json({ matches: [] });
  }
}
