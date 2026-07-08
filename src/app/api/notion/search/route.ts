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

function extractTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, { title?: Array<{ plain_text: string }> }> | undefined;
  if (props) {
    const titleProp = Object.values(props).find((p) => p.title && Array.isArray(p.title));
    if (titleProp?.title) return titleProp.title.map((t) => t.plain_text).join('');
  }
  const titleArr = page.title as Array<{ plain_text: string }> | undefined;
  if (titleArr) return titleArr.map((t) => t.plain_text).join('');
  return 'Untitled';
}

function extractIcon(page: Record<string, unknown>): string | null {
  const icon = page.icon as { type?: string; emoji?: string } | null;
  if (icon?.type === 'emoji') return icon.emoji ?? null;
  return null;
}

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
    return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') ?? '';
  const filter = searchParams.get('filter'); // 'page' | 'database' | null

  try {
    const body: Record<string, unknown> = {
      query,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 20,
    };

    if (filter === 'page' || filter === 'database') {
      body.filter = { property: 'object', value: filter };
    }

    const data = await notionFetch('/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const results = (data.results ?? []).map((page: Record<string, unknown>) => ({
      id: page.id,
      object: page.object,
      title: extractTitle(page),
      url: page.url,
      last_edited_time: page.last_edited_time,
      created_time: page.created_time,
      icon: extractIcon(page),
      parent_type: (page.parent as Record<string, unknown> | undefined)?.type ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
