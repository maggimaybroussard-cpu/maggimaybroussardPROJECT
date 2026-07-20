import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, state, category, mode, billTitle, caseContext } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build AI prompt based on mode
    let systemPrompt = `You are Lexi, a legal research assistant at Broussard Legal Services. 
You specialize in federal and state legislation research using Congress.gov data.
Always cite specific bill numbers, statutes, and code sections when available.
Use Bluebook citation format. Focus on Louisiana law when state-specific.
Always end with: "This is general legal information, not legal advice."`;

    let userPrompt = '';

    if (mode === 'summary') {
      systemPrompt += '\nProvide a concise AI summary of the legislation including: key provisions, who it affects, effective date, and practical implications.';
      userPrompt = `Summarize this legislation for a legal professional: "${billTitle}". ${state ? `Focus on implications for ${state}.` : ''} ${caseContext ? `Case context: ${caseContext}` : ''}`;
    } else if (mode === 'relevance') {
      systemPrompt += '\nAnalyze case relevance and tag the legislation with relevant practice areas and case types.';
      userPrompt = `Analyze the case relevance of: "${billTitle}". ${caseContext ? `For this case context: ${caseContext}` : ''} Return a JSON object with: { relevanceScore: 1-10, practiceAreas: [], caseTypes: [], keyProvisions: [], clientImpact: string, urgency: "high"|"medium"|"low" }`;
    } else if (mode === 'conflict') {
      systemPrompt += '\nIdentify federal-state law conflicts and preemption issues.';
      userPrompt = `Identify federal-state law conflicts for ${state || 'Louisiana'} regarding: ${query}. List specific conflicts with federal law, state law, conflict type (preemption/supremacy/concurrent), and resolution.`;
    } else {
      userPrompt = `Research legislation for ${state || 'federal'}: ${query}. ${category && category !== 'all' ? `Category: ${category}.` : ''} Provide recent relevant bills, statutes, and legal analysis.`;
    }

    // Call Perplexity AI
    const aiResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content || 'No response received.';

    // Save to lexi_research_history
    await supabase.from('lexi_research_history').insert({
      query: query || billTitle || userPrompt.substring(0, 200),
      response: content,
      research_type: mode || 'legislation',
      state_filter: state || null,
      category_filter: category || null,
      created_at: new Date().toISOString(),
    }).select().single();

    // Parse relevance data if in relevance mode
    let relevanceData = null;
    if (mode === 'relevance') {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) relevanceData = JSON.parse(jsonMatch[0]);
      } catch {
        relevanceData = null;
      }
    }

    return new Response(
      JSON.stringify({ content, relevanceData, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
