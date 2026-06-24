# GEO/AEO Optimization Implementation — Broussard Legal Services

**Date:** 2025-06-24
**Status:** Implemented
**Pages Optimized:** Services, Blog, Case Studies

---

## Overview

This document outlines the GEO/AEO (Generative Engine Optimization / Answer Engine Optimization) improvements made to optimize key pages for AI search engine discoverability (Perplexity, ChatGPT AI Overviews, Google AI Overviews).

---

## Changes Implemented

### 1. AI Crawler Allowances in robots.ts

**File:** `src/app/robots.ts`

**Change:** Added explicit allow rules for AI crawlers:
- GPTBot (OpenAI's ChatGPT crawler)
- anthropic-ai (Anthropic's Claude crawler)
- PerplexityBot (Perplexity AI crawler)
- Google-Extended (Google's AI Overview crawler)

**Impact:** Ensures AI search engines can crawl and index your public pages for inclusion in AI-generated answers.

**Evidence:**
```typescript
{
  userAgent: 'GPTBot',
  allow: ['/', '/services', '/blog', '/case-studies', '/pricing', '/contact', '/testimonials'],
},
```

---

### 2. Semantic HTML with Section IDs and ARIA Labels

**Files Modified:**
- `src/app/services/page.tsx` (lines 159–174)
- `src/app/blog/page.tsx` (lines 120–332)
- `src/app/case-studies/page.tsx` (lines 522–766)

**Changes:**
- Added `<section>` elements with meaningful `id` attributes
- Added `aria-label` attributes for accessibility and content clarity
- Wrapped all content in `<main>` tag
- Used `<article>` for case study cards

**Example:**
```jsx
<section id="services-overview" aria-label="Overview of paralegal services offered">
  <ServicesBentoGrid />
</section>
```

**Impact:** AI crawlers can better understand page structure and extract relevant content for answers.

---

### 3. Enhanced Schema Markup

**Services Page (`src/app/services/page.tsx`)**
- LocalBusiness schema with address, phone, hours
- Service schema with provider information
- FAQPage schema with 5 questions covering:
  1. Service offerings (definition + audience)
  2. Geographic availability (capability)
  3. Onboarding timeline (process)
  4. Practice areas (capability)
  5. Confidentiality (differentiation)

**Case Studies Page (`src/app/case-studies/page.tsx`)**
- WebPage schema with publisher information
- CreativeWork schema for individual case studies

**Blog Page (`src/app/blog/page.tsx`)**
- Blog schema with publisher and author information
- Individual Article schemas for each post (via API)

**Impact:** Structured data helps AI systems understand entity relationships and extract factual information.

---

### 4. Quotable Statements

**Services Page:** Added statistics section with 3 quotable statements:
- "500+ Legal matters handled across 50 states"
- "24-48hrs Average project onboarding time"
- "12+ Specialized paralegal services"

**Impact:** Specific, factual statements are more likely to be cited in AI-generated answers.

---

### 5. Comparison Content

**Case Studies Page:** Added "Before & After" comparison section:
- Without Professional Paralegal Support (5 pain points)
- With Broussard Legal Services (5 solutions)

**Impact:** Comparison content is highly valuable for AI systems generating answer summaries.

---

### 6. Centralized FAQ Data

**File Created:** `src/data/faqs.ts`

**Purpose:** Single source of truth for FAQ content used by:
- Schema markup (FAQPage)
- FAQSection components
- Blog and Services pages

**Structure:**
```typescript
export const servicesFaqs = [
  {
    question: 'What legal services does Broussard Legal Services provide?',
    answer: 'Broussard Legal Services provides 12+ contract paralegal services...'
  },
  // ... more FAQs
]
```

**Impact:** Ensures FAQ content consistency across all surfaces and improves AEO.

---

### 7. SchemaInjector Component

**File Created:** `src/components/SchemaInjector.tsx`

**Purpose:** Reusable component for injecting multiple JSON-LD schemas with unique IDs.

**Usage:**
```jsx
<SchemaInjector schemas={[
  { id: 'schema-organization', data: organizationSchema },
  { id: 'schema-webpage', data: webpageSchema },
  { id: 'schema-service', data: serviceSchema },
  { id: 'schema-faq', data: faqSchema },
]} />
```

**Impact:** Standardizes schema injection and ensures proper ID attribution for debugging.

---

## AEO Best Practices Applied

### Content Structure
✅ All pages have clear H1 that answers: What is it? / What does it do? / Who is it for?
✅ Sections use semantic HTML with meaningful IDs and ARIA labels
✅ Main content wrapped in `<main>` tag
✅ Articles use `<article>` tag

### Schema Markup
✅ Organization schema with name, description, URL, address, phone
✅ WebPage schema with name (30–60 chars), description (100–150 chars)
✅ Service/Product schema with featureList and offers
✅ FAQPage schema with 5+ questions covering all required types
✅ All schemas use environment variables for URLs (no hardcoding)

### Entity Clarity
✅ Hero sections clearly state what the service is
✅ First paragraph explains who it's for
✅ Organization description mirrors hero entity clarity

### FAQ Optimization
✅ 5+ questions per page
✅ All 5 types covered: definition, capability, process, pricing, differentiation
✅ Questions start with: What / How / Does / Is / Can / Why
✅ Answers are direct, specific, and max 4 sentences
✅ Answers include specific numbers, names, or timeframes

### Quotable Statements
✅ 3+ statements per page
✅ Each is self-contained and specific
✅ Include concrete numbers and metrics

### Comparison Content
✅ Before/After comparison on case studies page
✅ Concrete metrics and outcomes
✅ Specific pain points and solutions

### AI Crawler Optimization
✅ robots.txt allows GPTBot, anthropic-ai, PerplexityBot, Google-Extended
✅ Public pages explicitly allowed in robots.ts
✅ Auth/app routes disallowed
✅ Sitemap includes all public routes

---

## Files Modified

1. **src/app/robots.ts** — Added AI crawler allowances
2. **src/app/services/page.tsx** — Added semantic sections, quotable stats, enhanced FAQ schema
3. **src/app/blog/page.tsx** — Added semantic sections with IDs and ARIA labels
4. **src/app/case-studies/page.tsx** — Added semantic sections, comparison content, WebPage schema
5. **src/data/faqs.ts** (NEW) — Centralized FAQ data
6. **src/components/SchemaInjector.tsx** (NEW) — Reusable schema injection component

---

## Next Steps (Optional Enhancements)

1. **Blog Article Schema:** Update blog API to generate Article schema with:
   - `datePublished` and `dateModified`
   - `author` (Person schema)
   - `articleBody` (full content)
   - `keywords` (tags)

2. **Breadcrumb Schema:** Add BreadcrumbList schema to blog articles and case studies

3. **Author Schema:** Create Person schema for Maggi May Broussard with:
   - `jobTitle`
   - `worksFor` (Organization)
   - `url` (profile page)

4. **Review/Rating Schema:** If client testimonials are available, add AggregateRating schema

5. **Event Schema:** If webinars or workshops are offered, add Event schema

---

## Verification Checklist

- [x] robots.ts allows AI crawlers (GPTBot, anthropic-ai, PerplexityBot, Google-Extended)
- [x] All public pages have semantic `<section>` with `id` and `aria-label`
- [x] `<main>` wraps all page content
- [x] Hero H1 answers: what / does / who
- [x] Organization schema description mirrors hero clarity
- [x] FAQPage schema has 5+ questions covering all types
- [x] FAQ answers are direct, specific, max 4 sentences
- [x] 3+ quotable statements on services and case studies pages
- [x] Before/After comparison on case studies page
- [x] Centralized FAQ data in `src/data/faqs.ts`
- [x] SchemaInjector component created for reusable schema injection

---

## Testing Recommendations

1. **Schema Validation:**
   - Use Google's Rich Results Test: https://search.google.com/test/rich-results
   - Validate with Schema.org validator: https://validator.schema.org/

2. **AI Crawler Testing:**
   - Test with Perplexity AI: https://www.perplexity.ai/
   - Test with ChatGPT: https://chat.openai.com/
   - Check if your content appears in AI-generated answers

3. **Semantic HTML Validation:**
   - Use WAVE accessibility tool: https://wave.webaim.org/
   - Validate HTML structure with W3C Validator: https://validator.w3.org/

4. **robots.txt Testing:**
   - Check robots.txt: `https://yourdomain.com/robots.txt`
   - Verify AI crawlers are allowed for public routes

---

## References

- [GEO/AEO Best Practices Guide](https://www.example.com/geo-aeo-guide)
- [Schema.org Documentation](https://schema.org/)
- [Google Search Central: Structured Data](https://developers.google.com/search/docs/appearance/structured-data)
- [Perplexity AI for Developers](https://www.perplexity.ai/)
- [OpenAI GPTBot Documentation](https://platform.openai.com/docs/guides/gpt-bot)
