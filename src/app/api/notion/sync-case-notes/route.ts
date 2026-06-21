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

function blocksToMarkdown(blocks: NotionBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading_1':
          return `# ${extractPlainText(block.heading_1?.rich_text ?? [])}`;
        case 'heading_2':
          return `## ${extractPlainText(block.heading_2?.rich_text ?? [])}`;
        case 'heading_3':
          return `### ${extractPlainText(block.heading_3?.rich_text ?? [])}`;
        case 'paragraph':
          return extractPlainText(block.paragraph?.rich_text ?? []);
        case 'bulleted_list_item':
          return `• ${extractPlainText(block.bulleted_list_item?.rich_text ?? [])}`;
        case 'numbered_list_item':
          return `- ${extractPlainText(block.numbered_list_item?.rich_text ?? [])}`;
        case 'to_do':
          return `[${block.to_do?.checked ? 'x' : ' '}] ${extractPlainText(block.to_do?.rich_text ?? [])}`;
        case 'quote':
          return `> ${extractPlainText(block.quote?.rich_text ?? [])}`;
        case 'callout':
          return `📌 ${extractPlainText(block.callout?.rich_text ?? [])}`;
        case 'divider':
          return '---';
        default:
          return '';
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

export async function POST(req: NextRequest) {
  try {
    if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
      return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
    }

    const { caseId, query } = await req.json();
    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required.' }, { status: 400 });
    }

    // Search Notion for pages matching the query (case name / matter)
    const searchRes = await notionFetch('/search', {
      method: 'POST',
      body: JSON.stringify({
        query: query ?? '',
        filter: { value: 'page', property: 'object' },
        page_size: 10,
      }),
    });

    const pages: NotionSearchResult[] = searchRes.results ?? [];
    if (pages.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No Notion pages found for this query.' });
    }

    const supabase = await createClient();
    let synced = 0;

    for (const page of pages) {
      // Get page title
      let pageTitle = 'Untitled';
      if (page.properties) {
        const titleProp = Object.values(page.properties).find(
          (p) => p.title && Array.isArray(p.title)
        );
        if (titleProp?.title) {
          pageTitle = extractPlainText(titleProp.title);
        }
      } else if (page.title) {
        pageTitle = extractPlainText(page.title);
      }

      // Fetch page blocks (content)
      let content = `**${pageTitle}**\n\n`;
      try {
        const blocksRes = await notionFetch(`/blocks/${page.id}/children?page_size=100`);
        const markdown = blocksToMarkdown(blocksRes.results ?? []);
        if (markdown) content += markdown;
      } catch {
        content += '(Could not load page content)';
      }

      // Upsert into case_notes — one row per Notion page, keyed by notion_page_id
      const { error: upsertErr } = await supabase
        .from('case_notes')
        .upsert(
          {
            inquiry_id: caseId,
            notion_page_id: page.id,
            content,
            author: 'Notion Sync',
            source: 'notion',
            notion_synced_at: new Date().toISOString(),
          },
          { onConflict: 'notion_page_id' }
        );

      if (!upsertErr) synced++;
    }

    return NextResponse.json({ synced, total: pages.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('caseId');
    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('case_notes')
      .select('*')
      .eq('inquiry_id', caseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ notes: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
