/**
 * Lexi → Airtable Lead Sync
 * Syncs high-intent Lexi leads into the "Lexi Leads CRM" Airtable base.
 * Called fire-and-forget from the Lexi chat route when booking intent is detected.
 */

import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = 'app6Tk6mUPY4K4ydc';
const AIRTABLE_TABLE_ID = 'tblhotvinu6Jz2wxZ';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

interface LeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  serviceType?: string;
  intentScore?: 'High' | 'Medium' | 'Low';
  conversationSummary?: string;
  visitorId?: string;
}

function detectServiceType(messages: { role: string; content: string }[]): string {
  const fullText = messages.map((m) => m.content).join(' ').toLowerCase();
  if (fullText.includes('litigation') || fullText.includes('lawsuit') || fullText.includes('court') || fullText.includes('trial')) return 'Litigation Support';
  if (fullText.includes('contract') || fullText.includes('agreement') || fullText.includes('review')) return 'Contract Review';
  if (fullText.includes('research') || fullText.includes('case law') || fullText.includes('statute')) return 'Legal Research';
  if (fullText.includes('draft') || fullText.includes('document') || fullText.includes('letter') || fullText.includes('motion')) return 'Document Drafting';
  if (fullText.includes('case') || fullText.includes('matter') || fullText.includes('manage')) return 'Case Management';
  return 'General Inquiry';
}

function buildSummary(messages: { role: string; content: string }[]): string {
  const userMessages = messages.filter((m) => m.role === 'user').slice(-5);
  if (!userMessages.length) return 'No conversation captured.';
  return userMessages.map((m, i) => `Q${i + 1}: ${m.content}`).join('\n');
}

function extractContactInfo(messages: { role: string; content: string }[]): { name?: string; email?: string; phone?: string } {
  const fullText = messages.map((m) => m.content).join(' ');
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = fullText.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  const nameMatch = fullText.match(/(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  return {
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    name: nameMatch?.[1],
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Airtable not configured' }, { status: 500 });
  }

  let body: {
    messages?: { role: string; content: string }[];
    visitorId?: string;
    intentScore?: 'High' | 'Medium' | 'Low';
    name?: string;
    email?: string;
    phone?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages = [], visitorId, intentScore = 'High', name, email, phone } = body;

  // Extract contact info from conversation if not explicitly provided
  const extracted = extractContactInfo(messages);
  const finalName = name || extracted.name;
  const finalEmail = email || extracted.email;
  const finalPhone = phone || extracted.phone;
  const serviceType = detectServiceType(messages);
  const summary = buildSummary(messages);

  const fields: Record<string, string> = {
    'Lead Source': 'Lexi Chat',
    'Status': 'New',
    'Intent Score': intentScore,
    'Service Type': serviceType,
    'Conversation Summary': summary,
    'Created At': new Date().toISOString(),
  };

  if (finalName) fields['Name'] = finalName;
  if (finalEmail) fields['Email'] = finalEmail;
  if (finalPhone) fields['Phone'] = finalPhone;
  if (visitorId) fields['Visitor ID'] = visitorId;

  // Use visitor ID or email as the record name if no name found
  if (!finalName) {
    fields['Name'] = finalEmail || visitorId || `Lexi Lead ${new Date().toLocaleDateString()}`;
  }

  try {
    const res = await fetch(AIRTABLE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: [{ fields }] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Airtable Sync] Error:', err);
      return NextResponse.json({ error: 'Airtable sync failed', details: err }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, recordId: data.records?.[0]?.id });
  } catch (err) {
    console.error('[Airtable Sync] Network error:', err);
    return NextResponse.json({ error: 'Network error syncing to Airtable' }, { status: 500 });
  }
}
