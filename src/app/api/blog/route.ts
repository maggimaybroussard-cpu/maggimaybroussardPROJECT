import { NextRequest, NextResponse } from 'next/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = 'c45f58aad075484abfc8991431ecf59c';
const NOTION_VERSION = '2022-06-28';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  select?: { name: string } | null;
  multi_select?: Array<{ name: string }>;
  url?: string | null;
  date?: { start: string } | null;
  checkbox?: boolean;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
  created_time: string;
  last_edited_time: string;
}

function extractText(prop: NotionProperty | undefined): string {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map((t) => t.plain_text).join('') ?? '';
  if (prop.type === 'rich_text') return prop.rich_text?.map((t) => t.plain_text).join('') ?? '';
  if (prop.type === 'url') return prop.url ?? '';
  if (prop.type === 'select') return prop.select?.name ?? '';
  if (prop.type === 'date') return prop.date?.start ?? '';
  if (prop.type === 'multi_select') return prop.multi_select?.map((t) => t.name).join(', ') ?? '';
  return '';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: 'NOTION_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const filterConditions: object[] = [
      { property: 'Status', select: { equals: 'Published' } },
    ];

    if (category && category !== 'All') {
      filterConditions.push({ property: 'Category', select: { equals: category } });
    }

    const body: Record<string, unknown> = {
      filter: filterConditions.length === 1 ? filterConditions[0] : { and: filterConditions },
      sorts: [{ property: 'Published Date', direction: 'descending' }],
      page_size: 50,
    };

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Notion API error: ${err}` }, { status: res.status });
    }

    const data = await res.json();

    const posts = (data.results as NotionPage[]).map((page) => {
      const title = extractText(page.properties['Name']);
      const slug = extractText(page.properties['Slug']) || page.id;
      const excerpt = extractText(page.properties['Excerpt']);
      const category = extractText(page.properties['Category']);
      const coverImage = extractText(page.properties['Cover Image']);
      const author = extractText(page.properties['Author']);
      const publishedDate = extractText(page.properties['Published Date']);
      const readTime = extractText(page.properties['Read Time']);

      // Build JSON-LD structured data for each post
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description: excerpt,
        author: {
          '@type': 'Person',
          name: author || 'Maggi May Broussard',
          url: SITE_URL,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Broussard Legal Services',
          url: SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_URL}/assets/images/Broussardlogo-1781834380907.png`,
          },
        },
        datePublished: publishedDate ? `${publishedDate}T00:00:00Z` : page.created_time,
        dateModified: page.last_edited_time,
        image: coverImage || `${SITE_URL}/assets/images/og-image.png`,
        url: `${SITE_URL}/blog/${page.id}`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${SITE_URL}/blog/${page.id}`,
        },
        articleSection: category || 'Legal Services',
        keywords: `paralegal, legal services, Louisiana, ${category || 'legal guides'}`,
      };

      return {
        id: page.id,
        title,
        slug,
        excerpt,
        category,
        tags: page.properties['Tags']?.multi_select?.map((t) => t.name) ?? [],
        coverImage,
        author,
        publishedDate,
        readTime,
        createdTime: page.created_time,
        jsonLd,
      };
    });

    return NextResponse.json({ posts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
