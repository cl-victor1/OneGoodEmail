// Shared types for the resume → JD → email pipeline.

/** Step ① output — structured info extracted from the raw resume text. */
export interface ResumeProfile {
  name: string | null;
  headline: string | null; // e.g. "Senior Backend Engineer"
  yearsOfExperience: number | null;
  skills: string[];
  highlights: string[]; // quantified achievements, strongest selling points
  education: string[];
  summary: string; // 1–2 sentence positioning statement
}

/** Step ② output — key requirements distilled from the job description. */
export interface JobRequirements {
  roleTitle: string | null;
  company: string | null;
  mustHaves: string[];
  niceToHaves: string[];
  keywords: string[]; // ATS / recruiter keywords worth echoing
  tone: string; // suggested tone for the outreach, inferred from the JD
}

/** Step ③ output — the drafted email before the AI-taste pass. */
export interface EmailDraft {
  subject: string;
  body: string;
}

/** Step ④ output — final email after the "AI-flavor" self-check & rewrite. */
export interface FinalEmail extends EmailDraft {
  /** Notes on what the rewrite changed, for transparency in the UI. */
  revisionNotes: string[];
}

/** Full response returned by POST /api/generate. */
export interface GenerateResponse {
  profile: ResumeProfile;
  requirements: JobRequirements;
  email: FinalEmail;
}

/** Inputs the pipeline operates on once the resume has been parsed to text. */
export interface PipelineInput {
  resumeText: string;
  jobDescription: string;
  styleSample?: string; // optional pasted email used as a writing-style reference
}

// ─── Recipient lookup (company → founder email) ──────────────────────────────

/**
 * Confidence in the recipient address:
 *  - "verified": found published in public sources, or confirmed deliverable by the lookup
 *  - "likely":   the lookup found it but with a low score / catch-all domain — confirm first
 *  - "guess":    synthesized from name + domain, or no address at all
 */
export type RecipientConfidence = "verified" | "likely" | "guess";

/** Inputs to the recipient-finder. At least one of company/url should be set. */
export interface FindRecipientInput {
  company?: string; // e.g. "Acme AI"
  url?: string; // pasted official site or JD link (preferred — domain is free)
  founderName?: string; // optional user-supplied "Jane Doe"
}

/** Founder/CEO identified for the company. */
export interface Founder {
  firstName: string;
  lastName: string;
  title: string | null;
}

/** Result of the company → founder email lookup. Never an error — see `note`. */
export interface RecipientResult {
  email: string; // best address we have, even if guessed; "" when none
  confidence: RecipientConfidence;
  founder: Founder | null;
  domain: string;
  sources: string[]; // URLs the web_search step cited
  note: string; // human-facing guidance (e.g. "verify before sending")
}
