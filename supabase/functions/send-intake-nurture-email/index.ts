import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

// ─── Brand Styles ─────────────────────────────────────────────────────────────
const brand = {
  bg: "#FAF7F2",
  bgCard: "#FFFFFF",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  green: "#355E3B",
  greenLight: "#EAF2EB",
};

// ─── Layout Helpers ───────────────────────────────────────────────────────────

function emailWrapper(content: string, preheader = ""): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Broussard Legal Services</title>
      ${preheader ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div><!--<![endif]-->` : ""}
    </head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

            <!-- HEADER -->
            <tr>
              <td style="background-color:${brand.primary}; padding: 0;">
                <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px;">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="border-right: 2px solid ${brand.accent}; padding-right: 14px; vertical-align: middle;">
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Paralegal</p>
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Services</p>
                          </td>
                          <td style="padding-left: 14px; vertical-align: middle;">
                            <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Broussard Legal Services</h1>
                            <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family: Georgia, serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding: 36px 36px 32px;">
                ${content}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Broussard Legal Services</p>
                      <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                        You received this because you submitted an intake form at maggimay.com.
                        <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
                        &nbsp;·&nbsp;
                        <a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function badge(label: string, color = brand.accent): string {
  return `<span style="display:inline-block; background-color:${color}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">${label}</span>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${text}</h2>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${href}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;
}

function secondaryLink(href: string, label: string): string {
  return `<p style="margin:0 0 24px; font-size:13px; font-family: Georgia, serif;"><a href="${href}" style="color:${brand.accent}; text-decoration:underline;">${label}</a></p>`;
}

function highlightBox(content: string, borderColor = brand.accent): string {
  return `
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${borderColor}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      ${content}
    </div>
  `;
}

function greenBox(content: string): string {
  return `
    <div style="background-color:${brand.greenLight}; border-left:3px solid ${brand.green}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      ${content}
    </div>
  `;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${text}</p>`;
}

function checklistItem(text: string): string {
  return `<p style="margin:0 0 10px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#10003;&nbsp; ${text}</p>`;
}

function bulletItem(text: string): string {
  return `<p style="margin:0 0 10px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#8594;&nbsp; ${text}</p>`;
}

function signature(closing = "Warm regards"): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">${closing},</p>
          <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Broussard Legal Services</p>
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Broussard Legal Services</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Step 1 — Immediate: Intake Confirmation + What to Expect
 */
function step1IntakeConfirmation(name: string, caseType: string, urgency: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];
  const urgencyLabel = urgency === "urgent" ? "Urgent (24–48 hours)" : urgency === "priority" ? "Priority (3–5 days)" : "Standard (1–2 weeks)";

  const content = `
    ${badge("Intake Form Received", brand.green)}
    ${sectionTitle(`Your case details are in, ${firstName}`)}
    ${bodyText(`Thank you for completing the intake form. I've received all your case information and I'm already reviewing it so our consultation is as productive as possible.`)}
    ${greenBox(`
      <p style="margin:0 0 10px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Your Submission Summary</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;"><strong>Service Requested:</strong> ${caseType}</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;"><strong>Timeline:</strong> ${urgencyLabel}</p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;"><strong>Status:</strong> Under review — I'll come fully prepared to your consultation</p>
    `)}
    ${bodyText(`Here's what happens between now and your consultation:`)}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; margin:0 0 20px; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tr>
        <td style="padding:16px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 3px; font-size:13px; color:${brand.accent}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.06em;">TODAY</p>
          <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">I review your case details and prepare targeted questions</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 3px; font-size:13px; color:${brand.accent}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.06em;">BEFORE YOUR CONSULTATION</p>
          <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">I research relevant precedents and prepare a preliminary strategy outline</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 22px;">
          <p style="margin:0 0 3px; font-size:13px; color:${brand.accent}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.06em;">AT YOUR CONSULTATION</p>
          <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family: Georgia, serif;">We dive straight into your case — no time wasted on introductions</p>
        </td>
      </tr>
    </table>
    ${bodyText(`Need to add anything or have a question before we meet? Just reply to this email — I read every message personally.`)}
    ${ctaButton(`${SITE_URL}/availability`, "View or Reschedule Your Consultation", brand.green)}
    ${signature()}
  `;

  return {
    subject: `Intake received — I'm reviewing your ${caseType} case, ${firstName}`,
    html: emailWrapper(content, `Your intake form is in. I'm reviewing your case details before our consultation.`),
  };
}

/**
 * Step 2 — Day 1: Case Preparation Tips + Value-Add Content
 */
function step2CasePreparationTips(name: string, caseType: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Preparing for Your Consultation")}
    ${sectionTitle(`How to get the most out of our time, ${firstName}`)}
    ${bodyText(`I'm looking forward to our consultation about your <strong>${caseType}</strong> matter. To make sure we cover everything that matters most, here are a few things you can do to prepare:`)}
    ${highlightBox(`
      <p style="margin:0 0 12px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Before We Meet</p>
      ${checklistItem("Gather any relevant documents, correspondence, or filings related to your case")}
      ${checklistItem("Write down your top 3 questions or concerns — we'll address each one")}
      ${checklistItem("Note any upcoming deadlines, court dates, or filing windows")}
      ${checklistItem("Think about your ideal outcome — what does success look like for you?")}
    `)}
    ${bodyText(`The more context you can share, the more targeted and actionable our conversation will be. You've already given me a strong foundation with your intake form — this is just about making sure nothing falls through the cracks.`)}
    ${bodyText(`One thing I always tell attorneys I work with: the consultation is most valuable when you come with specific questions rather than a general overview. I've already read your case summary — let's use our time to go deep, not broad.`)}
    ${ctaButton(`${SITE_URL}/services`, "Review My Services Before We Meet")}
    ${secondaryLink(`mailto:maggimaybroussard@gmail.com`, "Have a question before the consultation? Email me directly &rarr;")}
    ${signature()}
  `;

  return {
    subject: `Preparing for your ${caseType} consultation, ${firstName} — a few tips`,
    html: emailWrapper(content, `Make the most of our consultation — a few preparation tips for your ${caseType} case.`),
  };
}

/**
 * Step 3 — Day 3: Social Proof + Case Study Relevant to Case Type
 */
function step3SocialProof(name: string, caseType: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("How I've Helped Similar Cases")}
    ${sectionTitle(`${firstName}, here's what working together looks like`)}
    ${bodyText(`As we get closer to our consultation, I wanted to share a bit about how I've helped other attorneys with <strong>${caseType}</strong> work — so you know exactly what to expect.`)}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; margin:0 0 20px; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tr>
        <td style="padding:22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 8px; font-size:13px; color:${brand.muted}; font-family: Georgia, serif; font-style:italic; line-height:1.7;">"Maggi came fully prepared to every meeting. She understood the nuances of our case immediately and delivered research memos that were ready to file. I've worked with many paralegals — she's in a different league."</p>
          <p style="margin:0; font-size:12px; color:${brand.accent}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.06em;">— Solo Practitioner, Civil Litigation</p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px;">
          <p style="margin:0 0 8px; font-size:13px; color:${brand.muted}; font-family: Georgia, serif; font-style:italic; line-height:1.7;">"We brought Maggi in for a complex discovery project with a tight deadline. She organized thousands of documents, flagged the critical ones, and had everything ready two days early. Exceptional work."</p>
          <p style="margin:0; font-size:12px; color:${brand.accent}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.06em;">— Partner, Mid-Size Litigation Firm</p>
        </td>
      </tr>
    </table>
    ${highlightBox(`
      <p style="margin:0 0 12px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">What Makes My Approach Different</p>
      ${bulletItem("<strong>Case-first mindset</strong> — I read your materials before we speak, not during")}
      ${bulletItem("<strong>Proactive communication</strong> — you'll never wonder where things stand")}
      ${bulletItem("<strong>Attorney-grade deliverables</strong> — work product ready for court or client use")}
      ${bulletItem("<strong>Flexible engagement</strong> — scale up or down based on your current caseload")}
    `)}
    ${bodyText(`I'm looking forward to showing you this firsthand during our consultation.`)}
    ${ctaButton(`${SITE_URL}/case-studies`, "Read Full Case Studies")}
    ${ctaButton(`${SITE_URL}/testimonials`, "Read More Client Testimonials", brand.primary)}
    ${signature()}
  `;

  return {
    subject: `What working together looks like — client stories, ${firstName}`,
    html: emailWrapper(content, `Real results from attorneys I've worked with — and what to expect from our consultation.`),
  };
}

/**
 * Step 4 — Day 7: Consultation Prep Checklist + Reminder
 */
function step4ConsultationPrepChecklist(name: string, caseType: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Consultation Prep Checklist")}
    ${sectionTitle(`${firstName}, your consultation prep checklist`)}
    ${bodyText(`Your consultation is coming up. Here's a quick checklist to make sure we're both ready to hit the ground running on your <strong>${caseType}</strong> matter:`)}
    ${greenBox(`
      <p style="margin:0 0 14px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Your Pre-Consultation Checklist</p>
      ${checklistItem("Review the case summary you submitted in your intake form")}
      ${checklistItem("Identify the 2–3 most pressing questions you need answered")}
      ${checklistItem("Have any relevant documents accessible (digital or physical)")}
      ${checklistItem("Note any hard deadlines or court dates in the next 30–60 days")}
      ${checklistItem("Think about your preferred engagement model: project-based or ongoing")}
    `)}
    ${bodyText(`On my end, I've reviewed your intake form and I'm preparing:`)}
    ${highlightBox(`
      ${bulletItem("A preliminary assessment of your <strong>${caseType}</strong> needs")}
      ${bulletItem("Relevant questions to clarify scope and priorities")}
      ${bulletItem("Initial thoughts on timeline and deliverables")}
      ${bulletItem("Pricing options that fit your engagement model")}
    `)}
    ${bodyText(`If anything has changed since you submitted your intake form — new developments, updated deadlines, or additional context — please reply to this email and I'll incorporate it before we meet.`)}
    ${ctaButton(`${SITE_URL}/availability`, "View Your Consultation Details")}
    ${signature("See you soon")}
  `;

  return {
    subject: `Your consultation prep checklist — ${caseType}, ${firstName}`,
    html: emailWrapper(content, `Quick checklist to make the most of your upcoming consultation.`),
  };
}

/**
 * Step 5 — Day 14: Post-Consultation Follow-Up / Re-Engagement
 */
function step5PostConsultationFollowUp(name: string, caseType: string): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("Following Up")}
    ${sectionTitle(`${firstName}, how can I help move things forward?`)}
    ${bodyText(`I hope our consultation was valuable and gave you a clear picture of how I can support your <strong>${caseType}</strong> work.`)}
    ${bodyText(`Whether you're ready to move forward, still evaluating your options, or have new questions that came up after our call — I'm here.`)}
    ${highlightBox(`
      <p style="margin:0 0 12px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Ready to Get Started?</p>
      ${bulletItem("<strong>Project-based</strong> — ideal for a single matter or defined deliverable")}
      ${bulletItem("<strong>Monthly retainer</strong> — consistent support across your active caseload")}
      ${bulletItem("<strong>Hourly</strong> — flexible, pay-as-you-go for occasional needs")}
      <p style="margin:12px 0 0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">All engagements start with a clear scope of work — no surprises.</p>
    `)}
    ${bodyText(`If the timing isn't right yet, that's completely fine. I'll be here when you're ready. And if you have a colleague who could use paralegal support, I'd be grateful for the introduction.`)}
    ${ctaButton(`${SITE_URL}/contact`, "Let's Discuss Next Steps")}
    ${ctaButton(`${SITE_URL}/availability`, "Book Another Call", brand.primary)}
    ${signature("Best")}
  `;

  return {
    subject: `Moving forward on your ${caseType} matter, ${firstName}`,
    html: emailWrapper(content, `Following up after our consultation — ready to move forward when you are.`),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const {
      sequenceId,
      submissionId,
      stepNumber,
      recipientEmail,
      recipientName,
      caseType,
      urgency,
    } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const service = caseType ?? "Legal Support";

    // Select the correct template based on step number
    let template: { subject: string; html: string };
    switch (stepNumber) {
      case 1:
        template = step1IntakeConfirmation(recipientName, service, urgency ?? "standard");
        break;
      case 2:
        template = step2CasePreparationTips(recipientName, service);
        break;
      case 3:
        template = step3SocialProof(recipientName, service);
        break;
      case 4:
        template = step4ConsultationPrepChecklist(recipientName, service);
        break;
      case 5:
        template = step5PostConsultationFollowUp(recipientName, service);
        break;
      default:
        template = step1IntakeConfirmation(recipientName, service, urgency ?? "standard");
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [recipientEmail],
        subject: template.subject,
        html: template.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Resend API error");
    }

    // Update sequence step status
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && sequenceId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("intake_nurture_sequences")
          .update({
            send_status: "sent",
            sent_at: new Date().toISOString(),
            resend_email_id: data.id ?? null,
          })
          .eq("id", sequenceId);
      } catch {
        // Non-blocking
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    // Mark sequence as failed
    try {
      const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
      const body = await (async () => {
        try { return await (req as any).json?.(); } catch { return {}; }
      })();
      if (body?.sequenceId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("intake_nurture_sequences")
          .update({ send_status: "failed", error_message: error.message })
          .eq("id", body.sequenceId);
      }
    } catch {
      // Non-blocking
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
