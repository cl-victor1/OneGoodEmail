import Anthropic from "@anthropic-ai/sdk";

// Default model for the whole prompt chain. Sonnet 4.6 — strong writing quality
// at lower latency/cost than Opus, well suited for the drafting + rewrite steps.
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set — add it to .env.local");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Run a single prompt-chain step. Returns the model's text output.
 *
 * `system` is cached (ephemeral) so repeated chain steps in one request reuse
 * the cached system prompt and only pay for the changing user content.
 */
export async function complete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: [
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: opts.user }],
  });

  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Convenience wrapper for steps that must return JSON. Strips ```json fences
 * the model sometimes adds, then parses. Throws on invalid JSON so the route
 * can surface a clear error.
 */
export async function completeJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const raw = await complete(opts);
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Model did not return valid JSON:\n${raw.slice(0, 500)}`);
  }
}
