import { NextResponse } from "next/server";
import { findRecipient } from "@/lib/recipient-finder";
import type { FindRecipientInput } from "@/types";

// web_search runs server-side via the Anthropic API; Node runtime, not edge.
export const runtime = "nodejs";
// web_search (multi round-trip) + Hunter can be slow. Note: Vercel Hobby caps
// function duration at 60s regardless of this value (Pro: 300s).
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FindRecipientInput;
    const company = body.company?.trim();
    const url = body.url?.trim();
    const founderName = body.founderName?.trim();

    if (!company && !url) {
      return NextResponse.json(
        { error: "Provide a company name or a website / job-posting URL." },
        { status: 400 },
      );
    }

    const result = await findRecipient({ company, url, founderName });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[/api/find-recipient]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
