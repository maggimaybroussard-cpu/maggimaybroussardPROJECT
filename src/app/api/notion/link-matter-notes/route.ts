/**
 * Notion → Clio: Matter Notes & Case Research Linker
 * POST: Searches Notion for pages related to a Clio matter and stores
 *       the links in Supabase (notion_matter_links table).
 * GET:  Returns all Notion pages linked to a specific Clio matter.
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

// ─── POST: Link Notion matter notes to a Clio matter ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
      return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const { clioMatterId, matterDescription, clientName } = body;

    if (!clioMatterId) {
      return NextResponse.json({ error: 'clioMatterId is required.' }, { status: 400 });
    }

    // Build search queries from matter context
    const searchTerms: string[] = [];
    if (matterDescription) searchTerms.push(matterDescription);
    if (clientName) searchTerms.push(`${clientName} case notes`);
    searchTerms.push('matter notes case research');
    searchTerms.push('case law analysis legal research');

    const pageIds = new Set<string>();
    const pageMap = new Map<string, NotionSearchResult>();

    for (const term of searchTerms) {
      try {
        const data = await notionFetch('/search', {
          method: 'POST',
          body: JSON.stringify({
            query: term,
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 8,
            filter: { property: 'object', value: 'page' },
          }),
        });

        const results: NotionSearchResult[] = (data as Record<string, unknown>).results as NotionSearchResult[] ?? [];
        for (const page of results) {
          if (!pageIds.has(page.id)) {
            pageIds.add(page.id);
            pageMap.set(page.id, page);
          }
          if (pageIds.size >= 10) break;
        }
      } catch {
        // Continue
      }
      if (pageIds.size >= 10) break;
    }

    if (pageIds.size === 0) {
      return NextResponse.json({ linked: 0, message: 'No Notion pages found for this matter.' });
    }

    const supabase = await createClient();
    let linked = 0;
    const linkedItems: Array<{ title: string; notionId: string; notionUrl: string; contentPreview: string }> = [];

    for (const [pageId, page] of pageMap.entries()) {
      const title = getPageTitle(page);

      // Fetch a preview of the page content
      let contentPreview = '';
      try {
        const blocksRes = await notionFetch(`/blocks/${pageId}/children?page_size=30`);
        const fullText = blocksToText((blocksRes as Record<string, unknown>).results as NotionBlock[] ?? []);
        contentPreview = fullText.slice(0, 1000);
      } catch {
        contentPreview = '';
      }

      // Upsert link into notion_matter_links table
      const { error: upsertErr } = await supabase
        .from('notion_matter_links')
        .upsert(
          {
            clio_matter_id: clioMatterId,
            notion_page_id: pageId,
            notion_url: page.url,
            page_title: title,
            content_preview: contentPreview,
            notion_last_edited: page.last_edited_time,
            linked_at: new Date().toISOString(),
          },
          { onConflict: 'clio_matter_id,notion_page_id' }
        );

      if (!upsertErr) {
        linked++;
        linkedItems.push({ title, notionId: pageId, notionUrl: page.url, contentPreview: contentPreview.slice(0, 200) });
      }
    }

    return NextResponse.json({
      linked,
      total: pageIds.size,
      clioMatterId,
      items: linkedItems,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET: Retrieve Notion notes linked to a Clio matter ──────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clioMatterId = searchParams.get('clioMatterId');

    if (!clioMatterId) {
      return NextResponse.json({ error: 'clioMatterId is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('notion_matter_links')
      .select('*')
      .eq('clio_matter_id', clioMatterId)
      .order('linked_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ links: data ?? [], total: data?.length ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
