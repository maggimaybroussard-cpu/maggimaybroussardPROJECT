import { NextRequest, NextResponse } from 'next/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_API_BASE = 'https://api.notion.com/v1';

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

function extractText(richText: Array<{ plain_text: string }> | undefined): string {
  return richText?.map((t) => t.plain_text).join('') ?? '';
}

interface RawBlock {
  id: string;
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

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
    return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get('pageId');
  if (!pageId) {
    return NextResponse.json({ error: 'pageId is required.' }, { status: 400 });
  }

  try {
    const data = await notionFetch(`/blocks/${pageId}/children?page_size=100`);

    const blocks = (data.results ?? []).map((block: RawBlock) => {
      let content = '';
      switch (block.type) {
        case 'heading_1': content = extractText(block.heading_1?.rich_text); break;
        case 'heading_2': content = extractText(block.heading_2?.rich_text); break;
        case 'heading_3': content = extractText(block.heading_3?.rich_text); break;
        case 'paragraph': content = extractText(block.paragraph?.rich_text); break;
        case 'bulleted_list_item': content = extractText(block.bulleted_list_item?.rich_text); break;
        case 'numbered_list_item': content = extractText(block.numbered_list_item?.rich_text); break;
        case 'to_do': content = extractText(block.to_do?.rich_text); break;
        case 'quote': content = extractText(block.quote?.rich_text); break;
        case 'callout': content = extractText(block.callout?.rich_text); break;
        default: content = '';
      }
      return { id: block.id, type: block.type, content };
    }).filter((b: { id: string; type: string; content: string }) => b.type !== 'unsupported');

    return NextResponse.json({ blocks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
