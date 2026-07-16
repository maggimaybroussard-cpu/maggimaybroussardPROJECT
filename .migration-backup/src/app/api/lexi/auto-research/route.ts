import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completion } from '@rocketnew/llm-sdk';

function buildAutoResearchPrompt(matterName: string, service: string, jurisdiction: string): string {
  return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services in Louisiana. A new legal matter has just been opened and you must conduct immediate background research.

MATTER: ${matterName}
PRACTICE AREA: ${service}
JURISDICTION: ${jurisdiction}

Conduct comprehensive background legal research covering:

1. **JURISDICTION LAWS** — Key Louisiana statutes (La. R.S.), Louisiana Civil Code provisions, and applicable federal laws governing this practice area. Include exact code sections.

2. **RECENT PRECEDENTS** — Notable Fifth Circuit and Louisiana Supreme Court / Court of Appeal decisions from the last 3 years relevant to this practice area. Include case names, citations, courts, and key holdings.

3. **PRACTICE AREA UPDATES** — Recent legislative changes, regulatory updates, or emerging legal trends in this practice area that counsel should be aware of.

4. **KEY PROCEDURAL RULES** — Applicable Louisiana Code of Civil Procedure (La. C.C.P.) provisions, local court rules, or federal procedural rules relevant to this matter type.

5. **STRATEGIC NOTES** — 2-3 practical considerations or risk factors for this type of matter in Louisiana / Fifth Circuit practice.

Format all case citations in proper Bluebook format. Cite only real, verifiable authorities. Be concise but thorough — this is a quick-reference brief for the attorney opening this matter.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matter_name, service, matter_ref, jurisdiction = 'Louisiana' } = body;

    if (!matter_name || !service) {
      return NextResponse.json({ error: 'matter_name and service are required' }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Perplexity API key not configured' }, { status: 500 });
    }

    // Run Perplexity research
    const response = await completion({
      model: 'perplexity/sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a legal research assistant specializing in Louisiana law and Fifth Circuit federal practice. Always cite real, verifiable authorities in proper Bluebook format. Provide structured, actionable research briefs.',
        },
        {
          role: 'user',
          content: buildAutoResearchPrompt(matter_name, service, jurisdiction),
        },
      ],
      stream: false,
      api_key: apiKey,
      temperature: 0.2,
      max_tokens: 1800,
      web_search_options: { search_context_size: 'medium' },
    } as Parameters<typeof completion>[0]);

    const researchContent = (response as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content ?? '';

    if (!researchContent) {
      return NextResponse.json({ error: 'No research content returned' }, { status: 500 });
    }

    // Save to lexi_research_history
    const supabase = await createClient();
    const query = `Auto-research: ${matter_name} (${service})`;
    const tags = [service.toLowerCase().replace(/\s+/g, '_'), 'auto-generated', jurisdiction.toLowerCase()];

    const { data: saved, error: dbError } = await supabase
      .from('lexi_research_history')
      .insert({
        query,
        category: 'all',
        summary: researchContent,
        matter_ref: matter_ref || null,
        matter_name: matter_name,
        tags,
        is_pinned: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to save research to history:', dbError);
      return NextResponse.json({ error: 'Research completed but failed to save', details: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, research: saved });
  } catch (error) {
    console.error('Auto-research error:', error);
    return NextResponse.json(
      { error: 'Auto-research failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
