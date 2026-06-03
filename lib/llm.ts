import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// Email-writing model — the resume→email drafting + rewrite steps. Sonnet 4.6:
// strong writing quality at lower latency/cost than Opus. This is the default
// "current model" for the prompt chain.
export const MODEL = process.env.ANTHROPIC_WRITING_MODEL ?? "claude-sonnet-4-6";

// Recipient-finding model — the company → founder/email web-search step. This
// research task benefits from Opus's stronger reasoning over search results, so
// it defaults to Opus 4.8 independently of the email-writing model above.
export const RECIPIENT_MODEL =
  process.env.ANTHROPIC_RECIPIENT_MODEL ?? "claude-opus-4-8";

// Hard ceiling for a single response's output budget. Structured outputs only
// constrain the *shape* of each token — they don't guarantee the JSON is ever
// *closed*. If the model runs out of tokens mid-object the document is truncated
// (e.g. "Unterminated string"), so we grow the budget toward this cap on a retry
// rather than surfacing an unparseable fragment.
const OUTPUT_TOKEN_CAP = 8192;

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
 * structured outputs (`output_config.format`).
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
  return runStructured<T>({
    model: MODEL,
    system: opts.system,
    user: opts.user,
    schema: opts.schema,
    maxTokens: opts.maxTokens ?? 2048,
  });
}

/**
 * Like `completeJSON`, but with the server-side web search tool enabled.
 * Structured outputs compose with web_search: Anthropic runs the searches and
 * still constrains the final answer to the schema.
 *
 * Note: search narration, tool calls, and the final JSON all share one
 * `max_tokens` budget, so this step truncates more easily than a plain
 * completion — `runStructured` grows the budget and retries when that happens.
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
  return runStructured<T>({
    model: RECIPIENT_MODEL,
    system: opts.system,
    user: opts.user,
    schema: opts.schema,
    maxTokens: opts.maxTokens ?? 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: opts.maxUses ?? 5,
      },
    ],
  });
}

/**
 * Core structured-output call with truncation resilience.
 *
 * We deliberately use `messages.create` (not the `messages.parse` helper) and
 * parse the JSON ourselves, because `.parse` calls `JSON.parse` on the raw text
 * block and *throws* the moment that text is incomplete — which is exactly what
 * a `max_tokens` truncation produces. Throwing gives us no chance to inspect
 * `stop_reason` and recover. By owning the parse we can:
 *   1. detect a `max_tokens` truncation explicitly and retry with a larger
 *      budget (doubling toward `OUTPUT_TOKEN_CAP`) before giving up, and
 *   2. emit a precise error when the JSON is genuinely malformed vs. merely cut
 *      short, instead of a generic "Failed to parse structured output".
 */
async function runStructured<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: OutputSchema;
  maxTokens: number;
  tools?: Anthropic.MessageCreateParams["tools"];
}): Promise<T> {
  let budget = Math.min(opts.maxTokens, OUTPUT_TOKEN_CAP);

  for (let attempt = 0; ; attempt++) {
    const message = await getClient().messages.create({
      model: opts.model,
      max_tokens: budget,
      system: [
        {
          type: "text",
          text: opts.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: jsonSchemaOutputFormat(opts.schema) },
      ...(opts.tools ? { tools: opts.tools } : {}),
    });

    // The structured answer is the model's final text block. (web_search adds
    // non-text tool blocks; the JSON is always the last text block.)
    const text = lastTextBlock(message);

    // Truncated before the object was closed → grow the budget and try again.
    if (message.stop_reason === "max_tokens") {
      if (budget < OUTPUT_TOKEN_CAP) {
        budget = Math.min(budget * 2, OUTPUT_TOKEN_CAP);
        continue;
      }
      throw new Error(
        `Model hit the output cap (${OUTPUT_TOKEN_CAP} tokens) before completing the JSON. ` +
          `Trim the input or raise OUTPUT_TOKEN_CAP.`,
      );
    }

    if (text == null) {
      throw new Error(
        `Model returned no text block (stop_reason: ${message.stop_reason}).`,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      // Finished for a non-budget reason yet still unparseable. Rare, but retry
      // once with more headroom in case a long string was clipped without the
      // API reporting max_tokens; otherwise surface the actual fragment.
      if (attempt === 0 && budget < OUTPUT_TOKEN_CAP) {
        budget = Math.min(budget * 2, OUTPUT_TOKEN_CAP);
        continue;
      }
      throw new Error(
        `Model returned unparseable structured output (${err instanceof Error ? err.message : err}). ` +
          `First 200 chars: ${text.slice(0, 200)}`,
      );
    }
  }
}

/** The model's final text block — where the structured JSON answer lives. */
function lastTextBlock(message: Anthropic.Message): string | null {
  for (let i = message.content.length - 1; i >= 0; i--) {
    const block = message.content[i];
    if (block.type === "text") return block.text;
  }
  return null;
}
