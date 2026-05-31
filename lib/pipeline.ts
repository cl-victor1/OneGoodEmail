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

  return { profile, requirements, email };
}
