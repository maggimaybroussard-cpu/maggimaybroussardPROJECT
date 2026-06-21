import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

// ─── Brand ───────────────────────────────────────────────────────────────────
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
};

// ─── Layout Helpers ───────────────────────────────────────────────────────────
function emailWrapper(content: string, preheader = "", unsubscribeUrl = ""): string {
  const unsubscribeLink = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>`
    : `<a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maggi May Broussard Legal Services</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <!-- Header -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You received this because you downloaded the free Paralegal Readiness Checklist at
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">maggimay.com</a>.
              &nbsp;&middot;&nbsp;
              ${unsubscribeLink}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(label: string): string {
  return `<span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">${label}</span>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 20px;font-size:24px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;line-height:1.3;">${text}</h2>`;
}

function body(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${text}</p>`;
}

function highlight(content: string): string {
  return `<div style="background-color:${brand.accentLight};border-left:3px solid ${brand.accent};padding:18px 22px;border-radius:0 8px 8px 0;margin:22px 0;">${content}</div>`;
}

function cta(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
    <tr>
      <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.30);">
        <a href="${href}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">${label} &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function secondaryLink(href: string, label: string): string {
  return `<p style="margin:0 0 24px;font-size:13px;font-family:Georgia,serif;"><a href="${href}" style="color:${brand.accent};text-decoration:underline;">${label}</a></p>`;
}

function sig(closing = "Warm regards"): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
    <tr>
      <td>
        <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">${closing},</p>
        <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
        <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
        <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
        &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
        <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimay.com</a>
      </td>
    </tr>
  </table>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * EMAIL 1 (Immediate): Welcome — sent right after checklist delivery.
 * Warms the subscriber, previews the 3-email series ahead.
 */
function subscriberWelcome(unsubscribeUrl = ""): { subject: string; html: string } {
  const content = `
    ${badge("Welcome")}
    ${heading("Your checklist is on its way — here's what comes next")}
    ${body("Your 8-Tip Paralegal Readiness Checklist should be in your inbox right now. I hope it gives you a clear picture of where paralegal support can make the biggest difference in your practice.")}
    ${body("Over the next two weeks I'll be sending you a short series that goes deeper on three of those areas — practical, attorney-tested guidance you can apply right away.")}
    ${highlight(`
      <p style="margin:0 0 10px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Your 3-email series</p>
      <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Day 3</strong> — Litigation preparation: a step-by-step approach from filing to trial</p>
      <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Day 7</strong> — Contract review: the clauses and red flags that matter most</p>
      <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Day 14</strong> — The engagement process: from first call to signed agreement</p>
    `)}
    ${body("In the meantime, if you have a matter coming up and want to talk through how I can help — my calendar is open for a free 30-minute consultation.")}
    ${cta(`${SITE_URL}/availability`, "Book a Free Consultation")}
    ${secondaryLink(`${SITE_URL}/services`, "Explore my services first")}
    ${sig()}
  `;
  return {
    subject: "Your checklist is here — and what's coming next",
    html: emailWrapper(content, "Your 8-tip checklist is on its way. Here's the 3-email series I'll be sending over the next two weeks.", unsubscribeUrl),
  };
}

/**
 * EMAIL 2 (Day 3): Litigation Prep deep-dive.
 * Covers the full litigation preparation process with actionable steps.
 */
function dripLitigationPrep(unsubscribeUrl = ""): { subject: string; html: string } {
  const content = `
    ${badge("Litigation Prep Series — Email 1 of 3")}
    ${heading("Litigation preparation: a step-by-step approach")}
    ${body("As promised — here's the first deep-dive from your checklist series. Litigation preparation is one of the areas where paralegal support has the most measurable impact on case outcomes.")}
    ${body("Here's the framework I use with every attorney I work with:")}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0 0 24px;background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background-color:${brand.primary};padding:12px 18px;">
          <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;font-family:Georgia,serif;">Pre-Litigation Document Checklist</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">1. Gather and Bates-stamp at intake</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Every document collected at intake should be numbered and logged immediately. Waiting until discovery multiplies the time required by 3–5x and increases the risk of missing key evidence.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">2. Build your deposition timeline 30 days out</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">A paralegal can draft the initial outline, flag key documents, prepare the exhibit list, and coordinate logistics — freeing you to focus entirely on strategy and witness preparation.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">3. Manage discovery requests end-to-end</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Track every request, response deadline, and objection in a single log. A paralegal can own this entirely — sending reminders, logging responses, and flagging anything overdue before it becomes a problem.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">4. Prepare a court filing deadline tracker</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Every critical date — motions, responses, hearings — should be in a shared calendar with 7-day and 24-hour reminders. A paralegal can maintain this across all active matters simultaneously.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">5. Coordinate witness interview preparation</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">A structured pre-interview checklist — covering background review, key question areas, and document review — ensures nothing is missed before you sit down with a witness.</p>
        </td>
      </tr>
    </table>
    ${highlight(`
      <p style="margin:0 0 8px;font-size:13px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;font-family:Georgia,serif;">Coming up on Day 7</p>
      <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">I'll walk through contract review — the specific clauses I flag most often and a simple system for tracking review status across multiple agreements.</p>
    `)}
    ${body("If you have a matter in active litigation and want to talk through how I can support the prep process, I'm happy to jump on a quick call.")}
    ${cta(`${SITE_URL}/availability`, "Schedule a Free 30-Min Call")}
    ${secondaryLink(`${SITE_URL}/services`, "View all paralegal services")}
    ${sig()}
  `;
  return {
    subject: "Litigation prep: a step-by-step approach (Email 1 of 3)",
    html: emailWrapper(content, "A step-by-step litigation preparation framework — from intake to deposition, discovery to trial.", unsubscribeUrl),
  };
}

/**
 * EMAIL 3 (Day 7): Contract Review deep-dive.
 * Covers red-flag clauses and a practical review process.
 */
function dripContractReview(unsubscribeUrl = ""): { subject: string; html: string } {
  const content = `
    ${badge("Contract Review Series — Email 2 of 3")}
    ${heading("Contract review: the clauses that matter most")}
    ${body("Here's the second email in your series — a practical look at contract review. This is one of the areas where a trained paralegal eye catches things that are easy to miss when you're moving quickly.")}
    ${body("<strong>The red-flag clauses I flag on every contract review:</strong>")}
    ${highlight(`
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr><td style="padding:6px 0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;border-bottom:1px solid ${brand.border};"><strong>Automatic renewal clauses</strong> — often buried in boilerplate, easy to miss until the renewal has already triggered</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;border-bottom:1px solid ${brand.border};"><strong>Indemnification scope</strong> — overly broad language that shifts all risk to your client, including third-party claims</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;border-bottom:1px solid ${brand.border};"><strong>Limitation of liability caps</strong> — check whether they apply to consequential damages and whether the cap is commercially reasonable</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;border-bottom:1px solid ${brand.border};"><strong>Dispute resolution clauses</strong> — mandatory arbitration, venue selection, and governing law provisions that may disadvantage your client</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;"><strong>IP ownership provisions</strong> — especially in service, consulting, and employment agreements where ownership of work product is ambiguous</td></tr>
      </table>
    `)}
    ${body("<strong>A simple contract review tracking system:</strong>")}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0 0 24px;background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Log every contract with a status field</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Draft received → Under review → Red flags flagged → Client briefed → Negotiation → Executed. A paralegal can maintain this log across all active matters.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Use a standardized red-flag summary memo</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">A one-page memo summarizing flagged clauses, recommended revisions, and risk level saves attorney review time and creates a clear record for the client file.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Track negotiation changes with a redline log</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Every version of a negotiated contract should be logged with the date, party who sent it, and a summary of changes. A paralegal can own this entirely.</p>
        </td>
      </tr>
    </table>
    ${highlight(`
      <p style="margin:0 0 8px;font-size:13px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;font-family:Georgia,serif;">Coming up on Day 14</p>
      <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">The final email in this series covers the engagement process — from first client call to signed retainer agreement — and how a paralegal can manage the entire onboarding workflow.</p>
    `)}
    ${body("If you have contracts coming up for review and want to discuss how I can support the process, I'd be glad to connect.")}
    ${cta(`${SITE_URL}/availability`, "Book a Free Consultation")}
    ${secondaryLink(`${SITE_URL}/case-studies`, "See how I've helped similar firms")}
    ${sig()}
  `;
  return {
    subject: "Contract review: the clauses that matter most (Email 2 of 3)",
    html: emailWrapper(content, "The contract red flags I flag on every review — and a simple tracking system to manage the process.", unsubscribeUrl),
  };
}

/**
 * EMAIL 4 (Day 14): Engagement Process deep-dive.
 * Covers the full client engagement workflow from first call to signed agreement.
 */
function dripEngagementProcess(unsubscribeUrl = ""): { subject: string; html: string } {
  const content = `
    ${badge("Engagement Process Series — Email 3 of 3")}
    ${heading("The engagement process: from first call to signed agreement")}
    ${body("This is the final email in your series — and in some ways the most important one. A well-run engagement process sets the tone for the entire client relationship and prevents the gaps that cause problems later.")}
    ${body("Here's how I help attorneys manage the engagement process end-to-end:")}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0 0 24px;background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background-color:${brand.primary};padding:12px 18px;">
          <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;font-family:Georgia,serif;">Engagement Process Workflow</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Step 1: Intake and conflict check</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">A paralegal can manage the initial intake form, collect all required information, run a conflict check against your existing client list, and flag any issues before the first consultation.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Step 2: Consultation preparation</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Before the first call, a paralegal can prepare a client summary, pull relevant case law or precedents, and draft a list of key questions — so you walk in fully prepared.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Step 3: Retainer and billing agreement</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">A paralegal can draft the engagement letter and retainer agreement, track the signature process, and ensure the billing setup is complete before work begins — protecting your fees from day one.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Step 4: Client communication log setup</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">From the first contact, every interaction should be logged — date, method, summary, and follow-up required. A paralegal can maintain this log and ensure nothing falls through the cracks.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 5px;font-size:14px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Step 5: Matter opening and file setup</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">Once engaged, a paralegal can open the matter, set up the file structure, create the deadline calendar, and brief you on the initial action items — so the matter starts moving immediately.</p>
        </td>
      </tr>
    </table>
    ${highlight(`
      <p style="margin:0 0 10px;font-size:13px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;font-family:Georgia,serif;">The result</p>
      <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">Attorneys who outsource the engagement process to a paralegal typically recover 4–6 hours per new matter — and report fewer billing disputes, better client communication, and stronger file organization from the start.</p>
    `)}
    ${body("That wraps up the three-email series. I hope it's been useful — and if any of it resonates with what you're dealing with in your practice right now, I'd love to connect.")}
    ${body("A free 30-minute consultation is the fastest way to figure out exactly where I can add value for your firm.")}
    ${cta(`${SITE_URL}/availability`, "Book Your Free Consultation")}
    ${secondaryLink(`${SITE_URL}/pricing`, "View service packages and pricing")}
    ${sig()}
  `;
  return {
    subject: "The engagement process: from first call to signed agreement (Email 3 of 3)",
    html: emailWrapper(content, "How a paralegal can manage your entire client engagement process — from intake to signed retainer.", unsubscribeUrl),
  };
}

/**
 * EMAIL 5 (Day 21): Final consultation prompt — soft re-engagement CTA.
 */
function consultationPromptStep1(unsubscribeUrl = ""): { subject: string; html: string } {
  const content = `
    ${badge("One Last Note")}
    ${heading("Still thinking about it? Let's make it easy.")}
    ${body("I've shared a few resources over the past few weeks, and I want to keep this one short.")}
    ${body("If you've been thinking about getting paralegal support but haven't taken the next step — I'd love to make it as easy as possible. Here's what a first engagement typically looks like:")}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0 0 24px;background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:14px 22px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;"><strong>Step 1:</strong> Free 30-minute call to discuss your needs — no commitment</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 22px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;"><strong>Step 2:</strong> I send a simple scope and flat-rate quote — no surprises</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 22px;border-bottom:1px solid ${brand.border};">
          <p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;"><strong>Step 3:</strong> We start — I can typically begin within one week</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 22px;">
          <p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;"><strong>Step 4:</strong> You get your time back — and your matters move faster</p>
        </td>
      </tr>
    </table>
    ${body("No long onboarding, no lock-in. Just practical support when you need it.")}
    ${cta(`${SITE_URL}/availability`, "Book a Free Consultation Now")}
    ${body(`<span style="font-size:13px;color:${brand.muted};">If the timing isn't right, no worries at all — feel free to reach out whenever you're ready. And if you'd prefer not to receive further emails, simply reply "unsubscribe."</span>`)}
    ${sig("Best")}
  `;
  return {
    subject: "Making it easy — here's what a first engagement looks like",
    html: emailWrapper(content, "A simple 4-step overview of what working together looks like — and how to get started.", unsubscribeUrl),
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
    const { sequenceId, subscriberId, subscriberEmail, sequenceType, stepNumber } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    // Look up subscriber's unsubscribe token for one-click unsubscribe link
    let unsubscribeUrl = `${SITE_URL}/api/unsubscribe`;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && subscriberId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: sub } = await supabase
          .from("email_subscribers")
          .select("unsubscribe_token")
          .eq("id", subscriberId)
          .maybeSingle();
        if (sub?.unsubscribe_token) {
          unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${sub.unsubscribe_token}`;
        }
      } catch {
        // Non-blocking — fall back to generic URL
      }
    }

    // Select template based on sequence type
    let template: { subject: string; html: string };
    if (sequenceType === "subscriber_welcome") {
      template = subscriberWelcome(unsubscribeUrl);
    } else if (sequenceType === "subscriber_drip_litigation") {
      template = dripLitigationPrep(unsubscribeUrl);
    } else if (sequenceType === "subscriber_drip_contract") {
      template = dripContractReview(unsubscribeUrl);
    } else if (sequenceType === "subscriber_drip_engagement") {
      template = dripEngagementProcess(unsubscribeUrl);
    } else if (sequenceType === "subscriber_consultation_prompt") {
      template = consultationPromptStep1(unsubscribeUrl);
    } else {
      template = subscriberWelcome(unsubscribeUrl);
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Maggi May Broussard <onboarding@resend.dev>",
        to: [subscriberEmail],
        subject: template.subject,
        html: template.html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Resend API error");

    // Update sequence status in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && sequenceId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("subscriber_email_sequences")
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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    // Mark sequence as failed
    try {
      const body = await (async () => { try { return await (req as any).json?.(); } catch { return {}; } })();
      const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
      if (body?.sequenceId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("subscriber_email_sequences")
          .update({ send_status: "failed", error_message: error.message })
          .eq("id", body.sequenceId);
      }
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
