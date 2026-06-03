// Orchestrates the company → founder email lookup:
//   ①+② one web_search call → { domain, founder, email?, sources }
//   ③ if web search already surfaced a published email, trust it and stop here —
//      the email-lookup API below is only a fallback, to save its quota.
//   ④ otherwise run the email-finder to discover/verify the address.
//   ⑤ tier the result by confidence; degrade to guidance, never throw.

import { completeJSONWithSearch } from "@/lib/llm";
import { findDomainAndFounderPrompt } from "@/lib/prompts";
import { findEmail } from "@/lib/hunter";
import type {
  FindRecipientInput,
  Founder,
  RecipientResult,
} from "@/types";

interface DomainFounderResult {
  domain: string;
  founder: Founder | null;
  email: string | null; // a published address the search found, if any
  confidence: "high" | "medium" | "low";
  sources: string[];
}

export async function findRecipient(
  input: FindRecipientInput,
): Promise<RecipientResult> {
  // ① Domain: if the user pasted a URL, take it for free (no model call).
  const knownDomain = input.url ? normalizeDomain(input.url) : undefined;

  // ①+② Resolve domain (if not already known) and the founder via web search.
  const research = await completeJSONWithSearch<DomainFounderResult>({
    ...findDomainAndFounderPrompt({
      company: input.company,
      knownDomain,
      knownFounderName: input.founderName,
    }),
    maxTokens: 4096,
  });

  const domain = knownDomain ?? normalizeDomain(research.domain);
  const founder = research.founder;
  const sources = research.sources ?? [];
  const foundEmail = research.email?.trim();

  // ③ Web search already surfaced a published address → trust it and stop.
  // This is the common case and costs nothing beyond the search we already ran.
  if (foundEmail) {
    return {
      email: foundEmail,
      confidence: "verified",
      founder,
      domain: domain || normalizeDomain(foundEmail.split("@")[1] ?? ""),
      sources,
      note: "Found published in public sources.",
    };
  }

  // No founder → can't even attempt a lookup; degrade to guidance.
  if (!founder || !domain) {
    return {
      email: "",
      confidence: "guess",
      founder,
      domain,
      sources,
      note: domain
        ? `Couldn't pin down the founder for ${domain}. Check the company's team or contact page.`
        : "Couldn't resolve the company. Try pasting the official site URL.",
    };
  }

  // ④ Fallback only: no published email was found, so discover/verify one.
  const lookup = await findEmail({
    domain,
    firstName: founder.firstName,
    lastName: founder.lastName,
  });

  // ⑤ Tier by the lookup outcome.
  if (lookup) {
    const verified =
      lookup.verificationStatus === "valid" ||
      (lookup.score !== null && lookup.score >= 80);
    return {
      email: lookup.email,
      confidence: verified ? "verified" : "likely",
      founder,
      domain,
      sources,
      note: verified
        ? "Verified deliverable."
        : "Best guess. Confirm before sending.",
    };
  }

  // Nothing found → synthesize the most common format.
  return {
    email: `${founder.firstName.toLowerCase()}@${domain}`,
    confidence: "guess",
    founder,
    domain,
    sources,
    note: "Suggested format (firstname@domain). Verify on the company's contact page or the founder's X / LinkedIn before sending.",
  };
}

/** Reduce a URL or messy domain string to its bare host: "https://www.acme.ai/x" → "acme.ai". */
function normalizeDomain(value: string): string {
  let host = value.trim();
  try {
    // Add a scheme if missing so URL() can parse "acme.ai/careers".
    host = new URL(/^https?:\/\//i.test(host) ? host : `https://${host}`).hostname;
  } catch {
    // Not URL-shaped — fall back to stripping a leading scheme/path manually.
    host = host.replace(/^https?:\/\//i, "").split("/")[0];
  }
  return host.replace(/^www\./i, "").toLowerCase();
}
