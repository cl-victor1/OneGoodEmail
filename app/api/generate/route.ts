import { NextResponse } from "next/server";
import { parseResume } from "@/lib/resume-parser";
import { runPipeline } from "@/lib/pipeline";

// Resume parsing (unpdf/mammoth) needs the Node runtime, not edge.
export const runtime = "nodejs";
// Pipeline makes several sequential LLM calls — give it room.
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const resume = form.get("resume");
    const jobDescription = (form.get("jobDescription") as string | null)?.trim();
    const styleSample = (form.get("styleSample") as string | null)?.trim() || undefined;

    if (!(resume instanceof File)) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
    }
    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required." }, { status: 400 });
    }

    const resumeText = await parseResume(resume);
    const result = await runPipeline({ resumeText, jobDescription, styleSample });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[/api/generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
