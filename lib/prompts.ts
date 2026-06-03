// The four prompt-chain steps. Each builder returns { system, user } strings.
// System prompts are static (cacheable); user prompts carry the per-request data.

import type {
  EmailDraft,
  JobRequirements,
  ResumeProfile,
} from "@/types";

// ─── Recipient lookup (company → founder), uses the web_search tool ──────────

// Find the company's primary domain and its founder/CEO via web search.
// When a url is supplied, the domain is derived in JS upstream and passed in as
// `knownDomain` so the model only has to find the person.
export function findDomainAndFounderPrompt(input: {
  company?: string;
  knownDomain?: string;
  knownFounderName?: string;
}) {
  const facts = [
    input.company ? `Company name: ${input.company}` : null,
    input.knownDomain ? `Known domain (use this, do not change it): ${input.knownDomain}` : null,
    input.knownFounderName ? `User says the founder is: ${input.knownFounderName} (verify the spelling and title)` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    system: `You research a company and find (1) its primary website domain and (2) its founder, co-founder, or CEO. Use web search. Prefer the company's official site for the domain, and people with founder/co-founder/CEO titles for the person.

Return ONLY valid JSON matching this TypeScript type, no prose, no markdown fences:

interface Result {
  domain: string;                 // bare domain, e.g. "acme.ai" — no scheme, no www, no path
  founder: {
    firstName: string;
    lastName: string;
    title: string | null;         // e.g. "Co-founder & CEO"
  } | null;                       // null if no founder/CEO can be confidently identified
  confidence: "high" | "medium" | "low";
  sources: string[];              // URLs you relied on
}

Rules:
- If a known domain is provided, return it verbatim and do not search for a different one.
- Normalize the domain to its bare form (strip https://, www., and any path).
- Only name a founder you actually found evidence for. If unsure, set founder to null and confidence to "low" rather than guessing a name.`,
    user: `Find the domain and founder/CEO for this company.\n\n${facts}`,
  };
}

// ① Extract structured info from the raw resume text.
export function extractResumePrompt(resumeText: string) {
  return {
    system: `You extract structured data from resumes. Return ONLY valid JSON matching this TypeScript type, no prose, no markdown fences:

interface ResumeProfile {
  name: string | null;
  headline: string | null;
  yearsOfExperience: number | null;
  skills: string[];
  highlights: string[];   // quantified, impressive achievements
  education: string[];
  summary: string;        // 1-2 sentence positioning statement
}

Infer yearsOfExperience from dates when not stated. Keep highlights concrete (numbers, scope, impact). If a field is unknown use null or [].`,
    user: `Resume:\n\n${resumeText}`,
  };
}

// ② Distill key requirements from the job description.
export function parseJobPrompt(jobDescription: string) {
  return {
    system: `You analyze job descriptions for a candidate writing an outreach email. Return ONLY valid JSON matching this TypeScript type, no prose, no markdown fences:

interface JobRequirements {
  roleTitle: string | null;
  company: string | null;
  mustHaves: string[];     // hard requirements the candidate must address
  niceToHaves: string[];
  keywords: string[];      // terms worth echoing for relevance
  tone: string;            // suggested email tone inferred from the JD (e.g. "warm but concise", "formal")
}`,
    user: `Job description:\n\n${jobDescription}`,
  };
}

// ③ Match profile to requirements and draft the email.
export function draftEmailPrompt(
  profile: ResumeProfile,
  requirements: JobRequirements,
  styleSample?: string,
) {
  const styleBlock = styleSample
    ? `\n\nThe candidate provided a sample of their own writing. Match its tone, rhythm, and vocabulary closely:\n"""\n${styleSample}\n"""`
    : "";

  return {
    system: `You write concise, high-conversion job-application outreach emails. Return ONLY valid JSON matching this TypeScript type, no prose, no markdown fences:

interface EmailDraft {
  subject: string;
  body: string;
}

Rules:
- Open with a specific hook tying the candidate to THIS role/company, not a generic greeting.
- Surface 2-3 of the candidate's strongest, most relevant highlights — map them to the role's must-haves.
- Keep it under ~180 words. Recruiters skim.
- End with a low-friction call to action.
- Use the suggested tone. Sign off with the candidate's name if known.${styleBlock}`,
    user: `Candidate profile:\n${JSON.stringify(profile, null, 2)}\n\nRole requirements:\n${JSON.stringify(requirements, null, 2)}`,
  };
}

// ④ AI-flavor self-check and rewrite — strip the "smells AI-written" tells.
export function deAiPrompt(draft: EmailDraft, styleSample?: string) {
  const styleBlock = styleSample
    ? `\n\nKeep it consistent with this writing sample:\n"""\n${styleSample}\n"""`
    : "";

  return {
    system: `You are an editor who removes the tells of AI-generated writing. Rewrite the email so it reads like a sharp human wrote it. Return ONLY valid JSON matching this TypeScript type, no prose, no markdown fences:

interface FinalEmail {
  subject: string;
  body: string;
  revisionNotes: string[];   // short bullets: what you changed and why
}

Eliminate these AI tells:
- Hollow openers ("I hope this email finds you well", "I am excited to...").
- Overused connectives ("moreover", "furthermore", "leverage", "delve", "robust", "passionate").
- Symmetrical, listy sentence structure.
- Vague enthusiasm with no specifics.

HARD RULE — no dash punctuation: the subject and body must NOT contain any em dash (—), en dash (–), or any other dash used as punctuation. Do not use a dash to join clauses or set off an aside. Rewrite into separate sentences or use a comma instead. (Ordinary hyphens inside compound words like "full-stack" are fine.)

Preserve the facts and the call to action. Make it tighter and more natural.${styleBlock}`,
    user: `Email to rewrite:\n${JSON.stringify(draft, null, 2)}`,
  };
}
