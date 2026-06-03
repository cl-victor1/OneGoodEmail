// Thin wrapper around Hunter's Email Finder. One call both guesses the most
// likely address format for {first, last, domain} and returns a confidence
// score + verification status. Returns null on any miss (no key, 4xx/5xx, 429
// quota, network/timeout) so the orchestrator can fall through to its guess
// tier instead of throwing. Docs: https://hunter.io/api-documentation/v2#email-finder

export interface HunterResult {
  email: string;
  score: number | null; // 0-100 deliverability confidence
  /** "valid" | "accept_all" | "webmail" | "invalid" | "unknown" | null */
  verificationStatus: string | null;
}

export async function findEmail(opts: {
  domain: string;
  firstName: string;
  lastName: string;
}): Promise<HunterResult | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.hunter.io/v2/email-finder");
  url.searchParams.set("domain", opts.domain);
  url.searchParams.set("first_name", opts.firstName);
  url.searchParams.set("last_name", opts.lastName);
  url.searchParams.set("api_key", apiKey);

  try {
    // Bound the request so a slow Hunter call can't blow the serverless timeout.
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null; // 429 quota, 4xx, 5xx → treat as a miss

    const json = (await res.json()) as {
      data?: {
        email?: string | null;
        score?: number | null;
        verification?: { status?: string | null } | null;
      };
    };

    const email = json.data?.email;
    if (!email) return null;

    return {
      email,
      score: json.data?.score ?? null,
      verificationStatus: json.data?.verification?.status ?? null,
    };
  } catch {
    return null; // network error / timeout / bad JSON
  }
}
