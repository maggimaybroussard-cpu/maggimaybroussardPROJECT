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

export async function POST(req: NextRequest) {
  if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
    return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
  }

  try {
    const { title, content, parentPageId } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    // Build parent object
    const parent = parentPageId?.trim()
      ? { type: 'page_id', page_id: parentPageId.trim() }
      : { type: 'workspace', workspace: true };

    // Build children blocks from content lines
    const children: unknown[] = [];
    if (content?.trim()) {
      const lines = content.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }],
          },
        });
      }
    }

    const body: Record<string, unknown> = {
      parent,
      properties: {
        title: {
          title: [{ type: 'text', text: { content: title.trim() } }],
        },
      },
    };

    if (children.length > 0) {
      body.children = children;
    }

    const page = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return NextResponse.json({ id: page.id, url: page.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
