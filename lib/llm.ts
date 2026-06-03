import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

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
 * A JSON Schema describing an object output. Passed to Anthropic's structured
 * outputs feature so the model is constrained to emit schema-valid JSON — no
 * prose, no fences, no truncated-mid-thought failures to parse around.
 */
export type OutputSchema = Parameters<typeof jsonSchemaOutputFormat>[0];

/**
 * Run a prompt-chain step that must return JSON, using Anthropic's native
 * structured outputs (`output_config.format`). The response is parsed and
 * validated against `schema` by the SDK and returned via `parsed_output`.
 *
 * `system` is cached (ephemeral) so repeated chain steps in one request reuse
 * the cached system prompt and only pay for the changing user content.
 */
export async function completeJSON<T>(opts: {
  system: string;
  user: string;
  schema: OutputSchema;
  maxTokens?: number;
}): Promise<T> {
  const message = await getClient().messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: [
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: jsonSchemaOutputFormat(opts.schema) },
  });

  return parsedOf<T>(message);
}

/**
 * Like `completeJSON`, but with the server-side web search tool enabled.
 * Structured outputs compose with web_search: Anthropic runs the searches and
 * still returns a guaranteed schema-valid object, so the model can no longer
 * narrate prose in place of the JSON answer.
 *
 * `maxUses` bounds how many searches the model may issue — important for both
 * latency (each search is a round trip) and cost (~$10 / 1k searches).
 */
export async function completeJSONWithSearch<T>(opts: {
  system: string;
  user: string;
  schema: OutputSchema;
  maxUses?: number;
  maxTokens?: number;
}): Promise<T> {
  const message = await getClient().messages.parse({
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
    output_config: { format: jsonSchemaOutputFormat(opts.schema) },
  });

  return parsedOf<T>(message);
}

/** Pull the validated structured output off a parsed message, or throw. */
function parsedOf<T>(message: { parsed_output: unknown }): T {
  if (message.parsed_output == null) {
    throw new Error(
      "Model returned no structured output. It may have stopped on max_tokens before completing the object — try a higher maxTokens.",
    );
  }
  return message.parsed_output as T;
}
