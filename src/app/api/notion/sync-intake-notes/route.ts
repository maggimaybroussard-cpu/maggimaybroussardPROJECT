/**
 * Notion → Admin Dashboard: Client Intake Notes Sync
 * POST: Searches Notion for intake-related pages and syncs them into
 *       the contact_inquiries table so they appear in the admin dashboard.
 * GET:  Returns previously synced intake notes from Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_API_BASE = 'https://api.notion.com/v1';

interface NotionSearchResult {
  id: string;
  object: string;
  url: string;
  properties?: Record<string, { title?: Array<{ plain_text: string }> }>;
  title?: Array<{ plain_text: string }>;
  last_edited_time: string;
  created_time: string;
}

interface NotionBlock {
  type: string;
  paragraph?: { rich_text: Array<{ plain_text: string }> };
  heading_1?: { rich_text: Array<{ plain_text: string }> };
  heading_2?: { rich_text: Array<{ plain_text: string }> };
  heading_3?: { rich_text: Array<{ plain_text: string }> };
  bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
  numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
  to_do?: { rich_text: Array<{ plain_text: string }>; checked: boolean };
  quote?: { rich_text: Array<{ plain_text: string }> };
  callout?: { rich_text: Array<{ plain_text: string }> };
  divider?: Record<string, unknown>;
}

function extractPlainText(richText: Array<{ plain_text: string }>): string {
  return richText?.map((t) => t.plain_text).join('') ?? '';
}

function blocksToText(blocks: NotionBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading_1': return `# ${extractPlainText(block.heading_1?.rich_text ?? [])}`;
        case 'heading_2': return `## ${extractPlainText(block.heading_2?.rich_text ?? [])}`;
        case 'heading_3': return `### ${extractPlainText(block.heading_3?.rich_text ?? [])}`;
        case 'paragraph': return extractPlainText(block.paragraph?.rich_text ?? []);
        case 'bulleted_list_item': return `• ${extractPlainText(block.bulleted_list_item?.rich_text ?? [])}`;
        case 'numbered_list_item': return `- ${extractPlainText(block.numbered_list_item?.rich_text ?? [])}`;
        case 'to_do': return `[${block.to_do?.checked ? 'x' : ' '}] ${extractPlainText(block.to_do?.rich_text ?? [])}`;
        case 'quote': return `> ${extractPlainText(block.quote?.rich_text ?? [])}`;
        case 'callout': return `📌 ${extractPlainText(block.callout?.rich_text ?? [])}`;
        case 'divider': return '---';
        default: return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

async function notionFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion API error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

function getPageTitle(page: NotionSearchResult): string {
  if (page.properties) {
    const titleProp = Object.values(page.properties).find(
      (p) => p.title && Array.isArray(p.title)
    );
    if (titleProp?.title) return extractPlainText(titleProp.title);
  }
  if (page.title) return extractPlainText(page.title);
  return 'Untitled';
}

// ─── POST: Sync intake notes from Notion ─────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
      return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const searchQuery: string = body.query ?? 'client intake notes';
    const maxPages: number = Math.min(body.maxPages ?? 20, 50);

    // Search Notion for intake-related pages
    const intakeQueries = [
      searchQuery,
      'client intake form notes',
      'new client information intake',
      'intake questionnaire responses',
    ];

    const pageIds = new Set<string>();
    const pageMap = new Map<string, NotionSearchResult>();

    for (const q of intakeQueries) {
      try {
        const data = await notionFetch('/search', {
          method: 'POST',
          body: JSON.stringify({
            query: q,
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 10,
            filter: { property: 'object', value: 'page' },
          }),
        });

        const results: NotionSearchResult[] = (data as Record<string, unknown>).results as NotionSearchResult[] ?? [];
        for (const page of results) {
          if (!pageIds.has(page.id)) {
            pageIds.add(page.id);
            pageMap.set(page.id, page);
          }
          if (pageIds.size >= maxPages) break;
        }
      } catch {
        // Continue with other queries
      }
      if (pageIds.size >= maxPages) break;
    }

    if (pageIds.size === 0) {
      return NextResponse.json({ synced: 0, message: 'No intake notes found in Notion.' });
    }

    const supabase = await createClient();
    let synced = 0;
    const syncedItems: Array<{ title: string; notionId: string; notionUrl: string }> = [];

    for (const [pageId, page] of pageMap.entries()) {
      const title = getPageTitle(page);

      // Fetch page content
      let content = `**${title}**\n\nSource: Notion | Last edited: ${new Date(page.last_edited_time).toLocaleDateString()}\n\n`;
      try {
        const blocksRes = await notionFetch(`/blocks/${pageId}/children?page_size=100`);
        const markdown = blocksToText((blocksRes as Record<string, unknown>).results as NotionBlock[] ?? []);
        if (markdown) content += markdown;
      } catch {
        content += '(Could not load page content)';
      }

      // Upsert into notion_intake_notes table (keyed by notion_page_id)
      const { error: upsertErr } = await supabase
        .from('notion_intake_notes')
        .upsert(
          {
            notion_page_id: pageId,
            notion_url: page.url,
            title,
            content,
            notion_last_edited: page.last_edited_time,
            notion_created_at: page.created_time,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'notion_page_id' }
        );

      if (!upsertErr) {
        synced++;
        syncedItems.push({ title, notionId: pageId, notionUrl: page.url });
      }
    }

    return NextResponse.json({
      synced,
      total: pageIds.size,
      items: syncedItems,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET: Retrieve synced intake notes ───────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const search = searchParams.get('search') ?? '';

    const supabase = await createClient();

    let query = supabase
      .from('notion_intake_notes')
      .select('*')
      .order('notion_last_edited', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ notes: data ?? [], total: data?.length ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
