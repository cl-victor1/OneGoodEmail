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

  return textOf(message);
}

/**
 * Run a prompt-chain step with the server-side web search tool enabled. Anthropic
 * executes the searches and resolves the tool loop inside this single request,
 * so the returned text is the model's final answer (same shape as `complete`).
 *
 * `maxUses` bounds how many searches the model may issue — important for both
 * latency (each search is a round trip) and cost (~$10 / 1k searches).
 */
export async function completeWithSearch(opts: {
  system: string;
  user: string;
  maxUses?: number;
  maxTokens?: number;
}): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: [
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: opts.maxUses ?? 5,
      },
    ],
    messages: [{ role: "user", content: opts.user }],
  });

  return textOf(message);
}

/** Concatenate and trim the text blocks of a message, dropping tool-use blocks. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Strip ```json fences the model sometimes adds, then parse. Throws on invalid
 * JSON so the caller can surface a clear error.
 */
function parseModelJSON<T>(raw: string): T {
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

/** Convenience wrapper for steps that must return JSON. */
export async function completeJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  return parseModelJSON<T>(await complete(opts));
}

/** Like `completeJSON`, but with the web search tool enabled. */
export async function completeJSONWithSearch<T>(opts: {
  system: string;
  user: string;
  maxUses?: number;
  maxTokens?: number;
}): Promise<T> {
  return parseModelJSON<T>(await completeWithSearch(opts));
}
