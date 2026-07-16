/**
 * Notion Knowledge Base Fetcher for Lexi AI Secretary
 * Pulls pages from Notion workspace and formats them as context
 * for Lexi's system prompt. Cached in-memory for 30 minutes.
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

interface KBCache {
  content: string;
  fetchedAt: number;
}

let kbCache: KBCache | null = null;
const KB_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Notion API Helpers ───────────────────────────────────────────────────────

async function notionFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

function extractPageTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, { title?: Array<{ plain_text: string }> }> | undefined;
  if (props) {
    const titleProp = Object.values(props).find((p) => p.title && Array.isArray(p.title));
    if (titleProp?.title) return titleProp.title.map((t) => t.plain_text).join('');
  }
  const titleArr = page.title as Array<{ plain_text: string }> | undefined;
  if (titleArr) return titleArr.map((t) => t.plain_text).join('');
  return 'Untitled';
}

/**
 * Extract plain text from Notion block content
 */
function extractBlockText(block: Record<string, unknown>): string {
  const type = block.type as string;
  const blockData = block[type] as Record<string, unknown> | undefined;
  if (!blockData) return '';

  const richText = blockData.rich_text as Array<{ plain_text: string }> | undefined;
  if (!richText) return '';

  const text = richText.map((t) => t.plain_text).join('');
  if (!text.trim()) return '';

  // Format headings
  if (type === 'heading_1') return `\n## ${text}`;
  if (type === 'heading_2') return `\n### ${text}`;
  if (type === 'heading_3') return `\n#### ${text}`;
  if (type === 'bulleted_list_item' || type === 'numbered_list_item') return `• ${text}`;
  if (type === 'quote') return `> ${text}`;
  return text;
}

/**
 * Fetch the text content of a Notion page (first 3000 chars to stay token-efficient)
 */
async function fetchPageContent(pageId: string): Promise<string> {
  try {
    const data = await notionFetch(`/blocks/${pageId}/children?page_size=50`) as Record<string, unknown>;
    const blocks = (data.results as Record<string, unknown>[]) ?? [];

    const lines: string[] = [];
    for (const block of blocks) {
      const text = extractBlockText(block);
      if (text) lines.push(text);
      if (lines.join('\n').length > 3000) break;
    }

    return lines.join('\n').slice(0, 3000);
  } catch {
    return '';
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Fetch and format Notion knowledge base content for Lexi's system prompt.
 * Returns a formatted string ready to be injected into the AI context.
 * Results are cached for 30 minutes.
 */
export async function getNotionKnowledgeBaseContext(): Promise<string> {
  // Return cached version if still fresh
  if (kbCache && Date.now() - kbCache.fetchedAt < KB_CACHE_TTL_MS) {
    return kbCache.content;
  }

  if (!NOTION_API_KEY || NOTION_API_KEY === 'your-notion-api-key-here') {
    return '';
  }

  try {
    // Search for KB/FAQ pages and legal articles
    const searchQueries = [
      { query: 'FAQ frequently asked questions', filter: 'page' },
      { query: 'knowledge base legal services', filter: 'page' },
      { query: 'paralegal services Louisiana law', filter: 'page' },
    ];

    const pageIds = new Set<string>();
    const pageTitles = new Map<string, string>();

    for (const { query, filter } of searchQueries) {
      try {
        const body: Record<string, unknown> = {
          query,
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: 8,
          filter: { property: 'object', value: filter },
        };

        const data = await notionFetch('/search', {
          method: 'POST',
          body: JSON.stringify(body),
        }) as Record<string, unknown>;

        const results = (data.results as Record<string, unknown>[]) ?? [];
        for (const page of results) {
          const id = page.id as string;
          if (!pageIds.has(id)) {
            pageIds.add(id);
            pageTitles.set(id, extractPageTitle(page));
          }
          if (pageIds.size >= 12) break;
        }
      } catch {
        // Continue with other queries
      }
      if (pageIds.size >= 12) break;
    }

    if (pageIds.size === 0) {
      return '';
    }

    // Fetch content for top pages (limit to 6 to stay token-efficient)
    const topPageIds = [...pageIds].slice(0, 6);
    const sections: string[] = [];

    for (const pageId of topPageIds) {
      const title = pageTitles.get(pageId) ?? 'Untitled';
      const content = await fetchPageContent(pageId);
      if (content.trim()) {
        sections.push(`### ${title}\n${content}`);
      }
    }

    if (sections.length === 0) {
      return '';
    }

    const formatted = `\n\n---\n## KNOWLEDGE BASE (from Notion)\nThe following articles and FAQs are from the Broussard Legal Services knowledge base. Use them to answer client questions accurately:\n\n${sections.join('\n\n---\n\n')}\n\n---`;

    // Cache the result
    kbCache = { content: formatted, fetchedAt: Date.now() };
    return formatted;
  } catch (err) {
    console.warn('[Lexi KB] Failed to fetch Notion knowledge base:', err);
    return '';
  }
}

/**
 * Invalidate the KB cache (call when Notion content is updated)
 */
export function invalidateKBCache(): void {
  kbCache = null;
}
