import { NextRequest, NextResponse } from 'next/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      leadScore,
      scoreTier,
      triggerType,
      serviceInterest,
      currentStep,
      totalSteps,
      lastEmailSentAt,
      followUpCount,
      conversionType,
      provider = 'ANTHROPIC',
      model = 'anthropic/claude-haiku-4-5',
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }

    // Build engagement context
    const engagementContext = [];
    if (currentStep && totalSteps) {
      engagementContext.push(`Currently on step ${currentStep} of ${totalSteps} in the nurture sequence`);
    }
    if (lastEmailSentAt) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastEmailSentAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      engagementContext.push(`Last email was sent ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`);
    }
    if (followUpCount) {
      engagementContext.push(`${followUpCount} follow-up${followUpCount !== 1 ? 's' : ''} have been sent so far`);
    }
    if (conversionType) {
      engagementContext.push(`Previously expressed interest in: ${conversionType}`);
    }

    const triggerLabels: Record<string, string> = {
      form_submission: 'submitted a contact form',
      abandoned_booking: 'started but did not complete a booking',
      intake_incomplete: 'began an intake form but did not finish',
      consultation_no_show: 'missed a scheduled consultation',
      post_consultation_no_convert: 'had a consultation but has not yet retained services',
    };
    const triggerDescription = triggerLabels[triggerType] || triggerType || 'engaged with the website';

    const tierGuidance: Record<string, string> = {
      hot:
        'This is a HOT lead (score 70+). Use a direct, confident, and slightly urgent tone. Emphasize immediate value and a clear call-to-action to book or call now.',
      warm:
        'This is a WARM lead (score 45–69). Use a helpful, informative tone. Provide value, address potential hesitations, and gently encourage the next step.',
      cold:
        'This is a COLD lead (score below 45). Use a soft, educational tone. Focus on building trust, sharing a relevant insight or resource, and keeping the door open without pressure.',
    };
    const toneGuidance = tierGuidance[scoreTier] || tierGuidance.warm;

    const systemPrompt = `You are an expert legal marketing copywriter for Broussard Legal Services, a professional paralegal firm. 
You write personalized, empathetic, and professional follow-up emails that feel human — never robotic or salesy.
The firm helps attorneys and individuals with paralegal support, document preparation, legal research, and case management.
Always write in first person from "Maggi Broussard" and sign off with her name.
Keep subject lines under 60 characters. Keep email body under 200 words. Use plain, warm language.`;

    const userPrompt = `Write a personalized follow-up email for this lead:

**Lead Details:**
- Name: ${name}
- Lead Score: ${leadScore}/100 (${scoreTier} tier)
- How they engaged: ${triggerDescription}
- Service interest: ${serviceInterest || 'General paralegal services'}
${engagementContext.length > 0 ? `- Engagement history: ${engagementContext.join('; ')}` : ''}

**Tone Guidance:**
${toneGuidance}

**Output Format (return valid JSON only, no markdown):**
{
  "subject": "Email subject line here",
  "preheader": "Short preview text (max 90 chars)",
  "body": "Full email body with greeting, 2-3 short paragraphs, and sign-off",
  "cta_text": "Call-to-action button text",
  "cta_url_hint": "Suggested destination (e.g. book-consultation, contact, services)"
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const content = await getChatCompletion(messages, {
      model,
      max_completion_tokens: 600,
      temperature: 0.7,
    });

    // Parse JSON from AI response
    let emailData: {
      subject: string;
      preheader: string;
      body: string;
      cta_text: string;
      cta_url_hint: string;
    };

    try {
      // Strip markdown code fences if present
      const cleaned = (content as string)
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      emailData = JSON.parse(cleaned);
    } catch {
      // Fallback: return raw content if JSON parse fails
      return NextResponse.json({
        subject: `Following up — ${name}`,
        preheader: 'A quick note from Maggi Broussard',
        body: content as string,
        cta_text: 'Schedule a Consultation',
        cta_url_hint: 'book-consultation',
        raw: true,
      });
    }

    return NextResponse.json(emailData);
  } catch (error) {
    console.error('Lead email generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email' },
      { status: 500 }
    );
  }
}
