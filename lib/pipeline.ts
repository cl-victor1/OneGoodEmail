// Orchestrates the 4-step LLM prompt chain:
//   ① extract resume  →  ② parse JD  →  ③ draft email  →  ④ AI-taste rewrite
// Steps ① and ② are independent, so they run in parallel.

import { completeJSON } from "@/lib/llm";
import {
  extractResumePrompt,
  parseJobPrompt,
  draftEmailPrompt,
  deAiPrompt,
} from "@/lib/prompts";
import type {
  EmailDraft,
  FinalEmail,
  GenerateResponse,
  JobRequirements,
  PipelineInput,
  ResumeProfile,
} from "@/types";

export async function runPipeline(
  input: PipelineInput,
): Promise<GenerateResponse> {
  // ① + ②  (independent — run concurrently)
  const [profile, requirements] = await Promise.all([
    completeJSON<ResumeProfile>(extractResumePrompt(input.resumeText)),
    completeJSON<JobRequirements>(parseJobPrompt(input.jobDescription)),
  ]);

  // ③ draft the email from the matched profile + requirements
  const draft = await completeJSON<EmailDraft>(
    draftEmailPrompt(profile, requirements, input.styleSample),
  );

  // ④ self-check for AI flavor and rewrite
  const email = await completeJSON<FinalEmail>(
    deAiPrompt(draft, input.styleSample),
  );

  // Hard guarantee: the email must never contain dash punctuation, regardless
  // of whether the model followed the prompt rule. This is belt-and-suspenders.
  const sanitized: FinalEmail = {
    ...email,
    subject: stripDashes(email.subject),
    body: stripDashes(email.body),
  };

  return { profile, requirements, email: sanitized };
}

/**
 * Remove every dash-as-punctuation character (em dash, en dash, horizontal bar,
 * figure dash, minus sign) and turn it into a comma break. Ordinary hyphens
 * (U+002D) inside compound words like "full-stack" are intentionally kept.
 */
function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–―‒−]\s*/g, ", ") // dash → comma break
    .replace(/\s+,/g, ",") // " ," → ","
    .replace(/,\s*,/g, ", ") // ",," → ", "
    .replace(/,(\s*[.!?;:])/g, "$1") // ", ." → "."
    .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces
    .replace(/ +\n/g, "\n") // trailing spaces before newline
    .trim();
}
