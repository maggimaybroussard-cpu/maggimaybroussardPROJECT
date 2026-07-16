/**
 * Notion Knowledge Base Fetcher for Lexi AI Secretary
 * Pulls four categories of Notion content into Lexi's AI context:
 *   1. Contract Templates & Legal SOPs
 *   2. Knowledge Base / FAQs (client-facing answers)
 *   3. Matter Notes & Case Research
 *   4. General Legal Guides
 * Cached in-memory for 30 minutes per category.
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

/**
 * Search Notion for pages matching a query and return up to `limit` unique page IDs + titles.
 */
async function searchNotion(
  query: string,
  limit: number,
  existingIds: Set<string>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  try {
    const body: Record<string, unknown> = {
      query,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: limit + 2,
      filter: { property: 'object', value: 'page' },
    };
    const data = await notionFetch('/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as Record<string, unknown>;

    const pages = (data.results as Record<string, unknown>[]) ?? [];
    for (const page of pages) {
      const id = page.id as string;
      if (!existingIds.has(id) && !results.has(id)) {
        results.set(id, extractPageTitle(page));
        if (results.size >= limit) break;
      }
    }
  } catch {
    // Non-blocking
  }
  return results;
}

// ─── Category Fetchers ────────────────────────────────────────────────────────

/**
 * Fetch contract templates and legal SOPs from Notion.
 */
async function fetchContractTemplatesAndSOPs(existingIds: Set<string>): Promise<string> {
  const queries = [
    'contract template agreement',
    'standard operating procedure SOP legal',
    'retainer agreement template',
    'legal document template checklist',
  ];

  const pageMap = new Map<string, string>();
  for (const q of queries) {
    const found = await searchNotion(q, 3, new Set([...existingIds, ...pageMap.keys()]));
    found.forEach((title, id) => pageMap.set(id, title));
    if (pageMap.size >= 4) break;
  }

  if (pageMap.size === 0) return '';

  const sections: string[] = [];
  for (const [pageId, title] of [...pageMap.entries()].slice(0, 4)) {
    existingIds.add(pageId);
    const content = await fetchPageContent(pageId);
    if (content.trim()) sections.push(`#### ${title}\n${content}`);
  }

  if (sections.length === 0) return '';
  return `\n### CONTRACT TEMPLATES & LEGAL SOPs\nUse these templates and procedures when drafting documents or explaining processes:\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Fetch knowledge base articles and FAQs for client-facing answers.
 */
async function fetchKnowledgeBaseAndFAQs(existingIds: Set<string>): Promise<string> {
  const queries = [
    'FAQ frequently asked questions legal services',
    'knowledge base client guide Louisiana law',
    'paralegal services what clients need to know',
    'legal process explained plain language',
  ];

  const pageMap = new Map<string, string>();
  for (const q of queries) {
    const found = await searchNotion(q, 3, new Set([...existingIds, ...pageMap.keys()]));
    found.forEach((title, id) => pageMap.set(id, title));
    if (pageMap.size >= 5) break;
  }

  if (pageMap.size === 0) return '';

  const sections: string[] = [];
  for (const [pageId, title] of [...pageMap.entries()].slice(0, 5)) {
    existingIds.add(pageId);
    const content = await fetchPageContent(pageId);
    if (content.trim()) sections.push(`#### ${title}\n${content}`);
  }

  if (sections.length === 0) return '';
  return `\n### KNOWLEDGE BASE & FAQs\nUse these articles to answer client questions accurately:\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Fetch matter notes and case research from Notion.
 */
async function fetchMatterNotesAndResearch(existingIds: Set<string>): Promise<string> {
  const queries = [
    'case research matter notes Louisiana',
    'case law analysis legal research',
    'matter file notes case strategy',
    'court filing research jurisdiction',
  ];

  const pageMap = new Map<string, string>();
  for (const q of queries) {
    const found = await searchNotion(q, 3, new Set([...existingIds, ...pageMap.keys()]));
    found.forEach((title, id) => pageMap.set(id, title));
    if (pageMap.size >= 4) break;
  }

  if (pageMap.size === 0) return '';

  const sections: string[] = [];
  for (const [pageId, title] of [...pageMap.entries()].slice(0, 4)) {
    existingIds.add(pageId);
    const content = await fetchPageContent(pageId);
    if (content.trim()) sections.push(`#### ${title}\n${content}`);
  }

  if (sections.length === 0) return '';
  return `\n### MATTER NOTES & CASE RESEARCH\nReference these research notes when discussing case strategy or legal precedents:\n\n${sections.join('\n\n---\n\n')}`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Fetch and format all Notion knowledge base content for Lexi's system prompt.
 * Covers: contract templates/SOPs, FAQs/KB articles, matter notes/case research.
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
    const seenIds = new Set<string>();

    // Fetch all four categories in parallel
    const [contractsAndSOPs, kbAndFAQs, matterNotes] = await Promise.all([
      fetchContractTemplatesAndSOPs(seenIds),
      fetchKnowledgeBaseAndFAQs(seenIds),
      fetchMatterNotesAndResearch(seenIds),
    ]);

    const sections = [contractsAndSOPs, kbAndFAQs, matterNotes].filter(Boolean);

    if (sections.length === 0) {
      return '';
    }

    const formatted = `\n\n---\n## NOTION WORKSPACE CONTEXT\nThe following content is pulled directly from the Broussard Legal Services Notion workspace. Use it to answer questions, draft documents, and provide accurate legal guidance:\n${sections.join('\n\n')}\n\n---`;

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
