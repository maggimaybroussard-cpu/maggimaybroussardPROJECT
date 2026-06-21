import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Scoring weights ────────────────────────────────────────────────────────────
const COMPLEXITY_WEIGHTS: Record<string, number> = {
  'Trial Preparation': 95,
  'Litigation Support': 90,
  'Discovery Assistance': 80,
  'Case Management': 70,
  'Document Drafting': 60,
  'Contract Review': 55,
  'Legal Research & Memos': 50,
  'Other': 40,
};

const URGENCY_WEIGHTS: Record<string, number> = {
  urgent: 100,
  priority: 65,
  standard: 30,
};

// Budget signals derived from case description keywords
const BUDGET_KEYWORDS: { keywords: string[]; score: number }[] = [
  { keywords: ['retainer', 'ongoing', 'long-term', 'monthly'], score: 90 },
  { keywords: ['trial', 'court', 'litigation', 'lawsuit', 'federal', 'appellate'], score: 85 },
  { keywords: ['corporate', 'enterprise', 'firm', 'company', 'business'], score: 75 },
  { keywords: ['urgent', 'emergency', 'imminent', 'deadline', 'filing'], score: 70 },
  { keywords: ['multiple', 'several', 'complex', 'extensive', 'comprehensive'], score: 65 },
  { keywords: ['contract', 'agreement', 'negotiation', 'settlement'], score: 55 },
  { keywords: ['research', 'memo', 'brief', 'draft', 'review'], score: 40 },
];

function computeComplexityScore(
  caseType: string,
  urgency: string,
  caseDescription: string,
  hasDocuments: boolean,
  hasOpposingParty: boolean
): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  // Case type base (40% weight)
  const typeScore = COMPLEXITY_WEIGHTS[caseType] ?? 40;
  score += typeScore * 0.4;
  signals.push(`Case type "${caseType}" → ${typeScore} pts`);

  // Urgency (30% weight)
  const urgencyScore = URGENCY_WEIGHTS[urgency] ?? 30;
  score += urgencyScore * 0.3;
  signals.push(`Urgency "${urgency}" → ${urgencyScore} pts`);

  // Description length (15% weight) — longer = more complex
  const descLen = caseDescription.trim().length;
  const descScore = Math.min(100, Math.round((descLen / 500) * 100));
  score += descScore * 0.15;
  signals.push(`Description length ${descLen} chars → ${descScore} pts`);

  // Documents uploaded (10% weight)
  if (hasDocuments) {
    score += 100 * 0.1;
    signals.push('Documents uploaded → +10 pts');
  }

  // Opposing party named (5% weight)
  if (hasOpposingParty) {
    score += 100 * 0.05;
    signals.push('Opposing party named → +5 pts');
  }

  return { score: Math.min(100, Math.round(score)), signals };
}

function computeBudgetScore(
  caseType: string,
  caseDescription: string,
  firmName: string | null,
  urgency: string
): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  const text = `${caseDescription} ${caseType}`.toLowerCase();

  // Keyword matching
  let keywordScore = 0;
  for (const { keywords, score: kScore } of BUDGET_KEYWORDS) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        keywordScore = Math.max(keywordScore, kScore);
        signals.push(`Keyword "${kw}" → ${kScore} pts`);
        break;
      }
    }
  }
  score += keywordScore * 0.5;

  // Firm name present = institutional client
  if (firmName && firmName.trim().length > 0) {
    score += 80 * 0.3;
    signals.push(`Firm name provided ("${firmName}") → +24 pts`);
  } else {
    score += 30 * 0.3;
    signals.push('No firm name → +9 pts');
  }

  // Urgency premium
  if (urgency === 'urgent') {
    score += 100 * 0.2;
    signals.push('Urgent timeline → +20 pts');
  } else if (urgency === 'priority') {
    score += 60 * 0.2;
    signals.push('Priority timeline → +12 pts');
  } else {
    score += 20 * 0.2;
    signals.push('Standard timeline → +4 pts');
  }

  return { score: Math.min(100, Math.round(score)), signals };
}

async function computeEngagementScore(
  supabase: ReturnType<typeof createClient>,
  email: string,
  inquiryId: string | null
): Promise<{ score: number; signals: string[] }> {
  const signals: string[] = [];
  let score = 0;

  // Check prior contact inquiries
  const { data: inquiries } = await supabase
    .from('contact_inquiries')
    .select('id, booking_stage, created_at')
    .eq('email', email.toLowerCase());

  const inquiryCount = inquiries?.length ?? 0;
  if (inquiryCount > 0) {
    const inquiryBonus = Math.min(40, inquiryCount * 15);
    score += inquiryBonus;
    signals.push(`${inquiryCount} prior inquiry(ies) → +${inquiryBonus} pts`);
  }

  // Check if they have a Calendly booking (consultation_booked stage)
  const hasBooking = inquiries?.some((i) =>
    ['consultation_booked', 'proposal_sent', 'active_client'].includes(i.booking_stage)
  );
  if (hasBooking) {
    score += 30;
    signals.push('Has consultation booking → +30 pts');
  }

  // Check prior intake submissions
  const { data: submissions } = await supabase
    .from('intake_submissions')
    .select('id')
    .eq('email', email.toLowerCase());

  const submissionCount = (submissions?.length ?? 0);
  if (submissionCount > 1) {
    score += 20;
    signals.push(`${submissionCount} intake submissions → +20 pts`);
  }

  // Check email sequences engagement (sent emails = they were nurtured)
  if (inquiryId) {
    const { data: sequences } = await supabase
      .from('email_sequences')
      .select('send_status')
      .eq('inquiry_id', inquiryId);

    const sentCount = sequences?.filter((s) => s.send_status === 'sent').length ?? 0;
    if (sentCount > 0) {
      const seqBonus = Math.min(20, sentCount * 4);
      score += seqBonus;
      signals.push(`${sentCount} nurture emails sent → +${seqBonus} pts`);
    }
  }

  // Check subscriber status
  const { data: subscriber } = await supabase
    .from('email_subscribers')
    .select('id, converted_at')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (subscriber) {
    score += 10;
    signals.push('Email subscriber → +10 pts');
    if (subscriber.converted_at) {
      score += 5;
      signals.push('Subscriber converted → +5 pts');
    }
  }

  if (signals.length === 0) {
    signals.push('No prior engagement history');
  }

  return { score: Math.min(100, Math.round(score)), signals };
}

function determineTierAndAction(
  total: number
): { tier: 'hot' | 'warm' | 'cold'; action: string } {
  if (total >= 70) {
    return {
      tier: 'hot',
      action: 'Priority personal outreach — call or email within 24 hours',
    };
  } else if (total >= 45) {
    return {
      tier: 'warm',
      action: 'Schedule follow-up within 48–72 hours; send personalized email',
    };
  } else {
    return {
      tier: 'cold',
      action: 'Enroll in nurture sequence; revisit in 7–14 days',
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      submissionId,
      inquiryId,
      email,
      name,
      caseType,
      caseDescription,
      urgency,
      firmName,
      hasDocuments,
      hasOpposingParty,
    } = body;

    if (!submissionId || !email || !name || !caseType || !caseDescription) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute the three score dimensions
    const complexity = computeComplexityScore(
      caseType,
      urgency ?? 'standard',
      caseDescription,
      !!hasDocuments,
      !!hasOpposingParty
    );

    const budget = computeBudgetScore(
      caseType,
      caseDescription,
      firmName ?? null,
      urgency ?? 'standard'
    );

    const engagement = await computeEngagementScore(supabase, email, inquiryId ?? null);

    // Weighted total: complexity 40%, budget 35%, engagement 25%
    const totalScore = Math.round(
      complexity.score * 0.4 +
      budget.score * 0.35 +
      engagement.score * 0.25
    );

    const { tier, action } = determineTierAndAction(totalScore);

    const signals = {
      complexity: complexity.signals,
      budget: budget.signals,
      engagement: engagement.signals,
    };

    // Upsert score (one score per submission)
    const { data: existing } = await supabase
      .from('prospect_scores')
      .select('id')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('prospect_scores')
        .update({
          complexity_score: complexity.score,
          budget_score: budget.score,
          engagement_score: engagement.score,
          total_score: totalScore,
          score_tier: tier,
          signals,
          recommended_action: action,
          scored_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('prospect_scores').insert({
        submission_id: submissionId,
        inquiry_id: inquiryId ?? null,
        email: email.toLowerCase(),
        name,
        complexity_score: complexity.score,
        budget_score: budget.score,
        engagement_score: engagement.score,
        total_score: totalScore,
        score_tier: tier,
        signals,
        recommended_action: action,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalScore,
        tier,
        action,
        complexity: complexity.score,
        budget: budget.score,
        engagement: engagement.score,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
