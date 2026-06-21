import { NextRequest, NextResponse } from 'next/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2022-06-28';

interface RichText {
  plain_text: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  href?: string | null;
}

interface Block {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

function richTextToHtml(richTexts: RichText[]): string {
  return richTexts
    .map((rt) => {
      let text = rt.plain_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (rt.annotations?.bold) text = `<strong>${text}</strong>`;
      if (rt.annotations?.italic) text = `<em>${text}</em>`;
      if (rt.annotations?.code) text = `<code>${text}</code>`;
      if (rt.annotations?.strikethrough) text = `<s>${text}</s>`;
      if (rt.annotations?.underline) text = `<u>${text}</u>`;
      if (rt.href) text = `<a href="${rt.href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      return text;
    })
    .join('');
}

function blockToHtml(block: Block): string {
  const type = block.type;
  const data = block[type] as Record<string, unknown>;
  const richText = (data?.rich_text as RichText[]) ?? [];
  const content = richTextToHtml(richText);

  switch (type) {
    case 'paragraph':
      return content ? `<p>${content}</p>` : '<br/>';
    case 'heading_1':
      return `<h1>${content}</h1>`;
    case 'heading_2':
      return `<h2>${content}</h2>`;
    case 'heading_3':
      return `<h3>${content}</h3>`;
    case 'bulleted_list_item':
      return `<li>${content}</li>`;
    case 'numbered_list_item':
      return `<li>${content}</li>`;
    case 'quote':
      return `<blockquote>${content}</blockquote>`;
    case 'code':
      return `<pre><code>${content}</code></pre>`;
    case 'divider':
      return '<hr/>';
    case 'callout': {
      const icon = (data?.icon as { emoji?: string })?.emoji ?? '💡';
      return `<div class="callout"><span>${icon}</span><div>${content}</div></div>`;
    }
    case 'image': {
      const imgData = data as Record<string, unknown>;
      const src =
        (imgData?.file as { url?: string })?.url ??
        (imgData?.external as { url?: string })?.url ??
        '';
      const caption = ((imgData?.caption as RichText[]) ?? []).map((r) => r.plain_text).join('');
      return src ? `<figure><img src="${src}" alt="${caption}" loading="lazy"/>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>` : '';
    }
    default:
      return content ? `<p>${content}</p>` : '';
  }
}

async function fetchBlocks(blockId: string): Promise<Block[]> {
  const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results as Block[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;

  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: 'NOTION_API_KEY is not configured' }, { status: 500 });
  }

  try {
    // Fetch page properties
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
      },
      next: { revalidate: 300 },
    });

    if (!pageRes.ok) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const page = await pageRes.json();
    const props = page.properties;

    const getTitle = (p: Record<string, unknown>) =>
      ((p['Name'] as { title?: Array<{ plain_text: string }> })?.title ?? [])
        .map((t) => t.plain_text)
        .join('');
    const getText = (key: string) =>
      ((props[key] as { rich_text?: Array<{ plain_text: string }> })?.rich_text ?? [])
        .map((t: { plain_text: string }) => t.plain_text)
        .join('');
    const getSelect = (key: string) =>
      (props[key] as { select?: { name: string } })?.select?.name ?? '';
    const getDate = (key: string) =>
      (props[key] as { date?: { start: string } })?.date?.start ?? '';
    const getUrl = (key: string) =>
      (props[key] as { url?: string })?.url ?? '';
    const getTags = () =>
      ((props['Tags'] as { multi_select?: Array<{ name: string }> })?.multi_select ?? []).map(
        (t) => t.name
      );

    // Fetch blocks
    const blocks = await fetchBlocks(pageId);

    // Group consecutive list items
    const htmlParts: string[] = [];
    let inBulletList = false;
    let inNumberedList = false;

    for (const block of blocks) {
      if (block.type === 'bulleted_list_item') {
        if (!inBulletList) { htmlParts.push('<ul>'); inBulletList = true; }
        htmlParts.push(blockToHtml(block));
      } else if (block.type === 'numbered_list_item') {
        if (!inNumberedList) { htmlParts.push('<ol>'); inNumberedList = true; }
        htmlParts.push(blockToHtml(block));
      } else {
        if (inBulletList) { htmlParts.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { htmlParts.push('</ol>'); inNumberedList = false; }
        htmlParts.push(blockToHtml(block));
      }
    }
    if (inBulletList) htmlParts.push('</ul>');
    if (inNumberedList) htmlParts.push('</ol>');

    return NextResponse.json({
      post: {
        id: pageId,
        title: getTitle(props),
        slug: getText('Slug') || pageId,
        excerpt: getText('Excerpt'),
        category: getSelect('Category'),
        tags: getTags(),
        coverImage: getUrl('Cover Image'),
        author: getText('Author'),
        publishedDate: getDate('Published Date'),
        readTime: getText('Read Time'),
        contentHtml: htmlParts.join('\n'),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
