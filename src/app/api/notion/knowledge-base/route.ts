/**
 * Notion Knowledge Base API Route
 * Returns formatted KB content from Notion for Lexi AI context.
 * GET  - fetch KB content (cached 30 min)
 * POST - invalidate cache and re-fetch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNotionKnowledgeBaseContext, invalidateKBCache } from '@/lib/lexi/notionKnowledgeBase';

export async function GET() {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey || notionKey === 'your-notion-api-key-here') {
    return NextResponse.json(
      { error: 'NOTION_API_KEY is not configured.', configured: false },
      { status: 503 }
    );
  }

  try {
    const content = await getNotionKnowledgeBaseContext();
    return NextResponse.json({
      configured: true,
      hasContent: content.length > 0,
      contentLength: content.length,
      preview: content.slice(0, 500),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey || notionKey === 'your-notion-api-key-here') {
    return NextResponse.json({ error: 'NOTION_API_KEY is not configured.' }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'invalidate') {
      invalidateKBCache();
      return NextResponse.json({ success: true, message: 'KB cache invalidated.' });
    }

    // Re-fetch and return fresh content
    invalidateKBCache();
    const content = await getNotionKnowledgeBaseContext();
    return NextResponse.json({
      success: true,
      hasContent: content.length > 0,
      contentLength: content.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
