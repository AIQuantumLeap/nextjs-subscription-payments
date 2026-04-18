import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PersonaConfig {
  name: string;
  company_name: string;
  product_description: string;
  industry: string;
  tone: 'formal' | 'conversational' | 'technical';
  value_propositions: string[];
  objections: { objection: string; response: string }[];
  icp: {
    job_titles?: string[];
    company_sizes?: string[];
    industries?: string[];
    geographies?: string[];
  };
  qualification_criteria: {
    question: string;
    qualifying_answer?: string;
    disqualifying_answer?: string;
  }[];
}

export interface MessageContext {
  direction: 'inbound' | 'outbound';
  subject?: string | null;
  body: string;
}

export interface ConversationAnalysis {
  intent: 'interested' | 'objection' | 'not_interested' | 'question' | 'out_of_office' | 'unsubscribe';
  should_reply: boolean;
  should_qualify: boolean;
  should_disqualify: boolean;
  should_handoff: boolean;
  is_unsubscribe: boolean;
  qualification_answers: Record<string, string>;
  email_subject: string;
  email_body: string;
  handoff_summary?: string;
  recommended_next_step?: string;
}

const TONE_GUIDE: Record<PersonaConfig['tone'], string> = {
  formal:         'Write in a professional, formal tone. Use complete sentences and proper titles (Mr./Ms.). Be courteous and precise.',
  conversational: 'Write in a friendly, approachable tone. Use first names. Be warm and personable without being unprofessional.',
  technical:      'Write in a precise, technical tone. Lead with data, specifics, and industry terminology. Avoid fluff.'
};

function buildSystemPrompt(persona: PersonaConfig): string {
  const vps = persona.value_propositions.map((v, i) => `  ${i + 1}. ${v}`).join('\n');

  const objs = persona.objections.length
    ? persona.objections.map((o) => `  • "${o.objection}" → "${o.response}"`).join('\n')
    : '  (none configured)';

  const icpLines = [
    persona.icp.job_titles?.length      && `  Roles: ${persona.icp.job_titles.join(', ')}`,
    persona.icp.company_sizes?.length   && `  Sizes: ${persona.icp.company_sizes.join(', ')}`,
    persona.icp.industries?.length      && `  Industries: ${persona.icp.industries.join(', ')}`,
    persona.icp.geographies?.length     && `  Geographies: ${persona.icp.geographies.join(', ')}`
  ].filter(Boolean).join('\n') || '  (open to all)';

  const qualCriteria = persona.qualification_criteria.length
    ? persona.qualification_criteria
        .map((c, i) =>
          `  ${i + 1}. Question: "${c.question}"\n     Qualifies if: "${c.qualifying_answer ?? 'positive answer'}"\n     Disqualifies if: "${c.disqualifying_answer ?? 'negative answer'}"`
        )
        .join('\n')
    : '  Qualify if the lead expresses genuine interest and willingness to move forward.';

  return `You are ${persona.name}, a sales development representative at ${persona.company_name}.

PRODUCT / SERVICE:
${persona.product_description}

INDUSTRY: ${persona.industry}
TONE: ${TONE_GUIDE[persona.tone]}

VALUE PROPOSITIONS:
${vps}

OBJECTION HANDLING:
${objs}

IDEAL CUSTOMER PROFILE:
${icpLines}

QUALIFICATION CRITERIA:
${qualCriteria}

ABSOLUTE RULES:
1. You are a human sales rep. NEVER reveal or hint you are an AI under any circumstances.
2. Keep emails concise: 3–4 short paragraphs max. No walls of text.
3. After 5 total exchanges, you MUST make a final decision: qualify, disqualify, or hand off. Do not continue indefinitely.
4. If the lead says anything meaning "stop emailing", "unsubscribe", "remove me", or expresses they are not interested and don't want further contact, set is_unsubscribe: true and should_reply: false.
5. Match the tone exactly. Do not deviate.
6. Respond with ONLY a valid JSON object. No preamble, no markdown, no commentary.

RESPONSE FORMAT:
{
  "intent": "interested|objection|not_interested|question|out_of_office|unsubscribe",
  "should_reply": true,
  "should_qualify": false,
  "should_disqualify": false,
  "should_handoff": false,
  "is_unsubscribe": false,
  "qualification_answers": {},
  "email_subject": "Subject line",
  "email_body": "Plain text email body",
  "handoff_summary": "Summary for human rep (only when should_handoff: true)",
  "recommended_next_step": "e.g. Schedule 30-min discovery call (only when should_handoff: true)"
}`;
}

function parseJsonResponse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return fallback;
  }
}

export async function generateFirstOutreach(
  persona: PersonaConfig,
  lead: {
    first_name: string;
    last_name: string;
    company?: string | null;
    job_title?: string | null;
    context_fields?: Record<string, string>;
  }
): Promise<{ subject: string; body: string }> {
  const contextExtra = lead.context_fields && Object.keys(lead.context_fields).length > 0
    ? `Additional context: ${JSON.stringify(lead.context_fields)}`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: [{ type: 'text', text: buildSystemPrompt(persona), cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Write a personalized first cold outreach email to this prospect.

PROSPECT:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company ?? 'unknown'}
- Title: ${lead.job_title ?? 'unknown'}
${contextExtra}

Output only JSON: { "subject": "...", "body": "..." }`
      }
    ]
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
  return parseJsonResponse(text, {
    subject: `Quick question about ${lead.company ?? 'your team'}`,
    body: text
  });
}

export async function processIncomingEmail(
  persona: PersonaConfig,
  lead: { first_name: string; last_name: string; company?: string | null; email: string },
  messageHistory: MessageContext[],
  latestInbound: MessageContext,
  exchangeCount: number,
  existingQualificationAnswers: Record<string, string>
): Promise<ConversationAnalysis> {
  const agentName = persona.name;
  const leadName = `${lead.first_name} ${lead.last_name}`;

  const threadText = messageHistory
    .map(
      (m) =>
        `[${m.direction === 'outbound' ? agentName : leadName}]\nSubject: ${m.subject ?? '(none)'}\n${m.body}`
    )
    .join('\n\n---\n\n');

  const existingAnswersNote =
    Object.keys(existingQualificationAnswers).length > 0
      ? `\nQualification answers captured so far: ${JSON.stringify(existingQualificationAnswers)}`
      : '';

  const forceDecision =
    exchangeCount >= 4
      ? '\n\n⚠ FINAL EXCHANGE: You MUST set should_qualify, should_disqualify, or should_handoff to true. Do not reply without making a decision.'
      : '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: [{ type: 'text', text: buildSystemPrompt(persona), cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `THREAD HISTORY:
${threadText || '(no prior messages)'}

---
LATEST MESSAGE FROM ${leadName.toUpperCase()}:
Subject: ${latestInbound.subject ?? '(none)'}
${latestInbound.body}

---
Exchange: ${exchangeCount + 1} / 5 max
Lead: ${leadName} <${lead.email}>, ${lead.company ?? 'unknown company'}${existingAnswersNote}${forceDecision}

Analyze this reply and output the JSON response.`
      }
    ]
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
  return parseJsonResponse<ConversationAnalysis>(text, {
    intent: 'not_interested',
    should_reply: false,
    should_qualify: false,
    should_disqualify: false,
    should_handoff: false,
    is_unsubscribe: false,
    qualification_answers: {},
    email_subject: '',
    email_body: ''
  });
}
