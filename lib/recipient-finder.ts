// Orchestrates the company → founder email lookup:
//   ①+② one web_search call → { domain, founder, sources }
//   ③ Hunter email-finder → verified address + score
//   ④ tier the result by confidence; degrade to guidance, never throw.

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
  confidence: "high" | "medium" | "low";
  sources: string[];
}

export async function findRecipient(
  input: FindRecipientInput,
): Promise<RecipientResult> {
  // ① Domain: if the user pasted a URL, take it for free (no model call).
  const knownDomain = input.url ? normalizeDomain(input.url) : undefined;

  // ①+② Resolve domain (if not already known) and the founder via web search.
  const research = await completeJSONWithSearch<DomainFounderResult>(
    findDomainAndFounderPrompt({
      company: input.company,
      knownDomain,
      knownFounderName: input.founderName,
    }),
  );

  const domain = knownDomain ?? normalizeDomain(research.domain);
  const founder = research.founder;
  const sources = research.sources ?? [];

  // ④ No founder → degrade to guidance.
  if (!founder || !domain) {
    return {
      email: "",
      confidence: "guess",
      founder,
      domain,
      hunterScore: null,
      sources,
      note: domain
        ? `Couldn't pin down the founder for ${domain}. Check the company's team or contact page.`
        : "Couldn't resolve the company. Try pasting the official site URL.",
    };
  }

  // ③ Verify / discover the address with Hunter.
  const hunter = await findEmail({
    domain,
    firstName: founder.firstName,
    lastName: founder.lastName,
  });

  // ④ Tier by Hunter outcome.
  if (hunter) {
    const verified =
      hunter.verificationStatus === "valid" ||
      (hunter.score !== null && hunter.score >= 80);
    return {
      email: hunter.email,
      confidence: verified ? "verified" : "likely",
      founder,
      domain,
      hunterScore: hunter.score,
      sources,
      note: verified
        ? "Verified by Hunter."
        : "Best guess from Hunter. Confirm before sending.",
    };
  }

  // Hunter missed / no key / quota → synthesize the most common format.
  return {
    email: `${founder.firstName.toLowerCase()}@${domain}`,
    confidence: "guess",
    founder,
    domain,
    hunterScore: null,
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
