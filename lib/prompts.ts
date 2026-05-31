// The four prompt-chain steps. Each builder returns { system, user } strings.
// System prompts are static (cacheable); user prompts carry the per-request data.

import type {
  EmailDraft,
  JobRequirements,
  ResumeProfile,
} from "@/types";

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
- Symmetrical, listy sentence structure and em-dash overuse.
- Vague enthusiasm with no specifics.
Preserve the facts and the call to action. Make it tighter and more natural.${styleBlock}`,
    user: `Email to rewrite:\n${JSON.stringify(draft, null, 2)}`,
  };
}
