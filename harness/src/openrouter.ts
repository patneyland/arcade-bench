/**
 * Thin OpenRouter client wrapper.
 *
 * OpenRouter is OpenAI-compatible, so we use the `openai` SDK pointed at the
 * OpenRouter base URL. The actual chat-completion call is injectable so the
 * module is unit-testable without a real API key or network access.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** The minimal shape of a chat completion we depend on. */
export interface ChatCompletionLike {
  choices: Array<{
    message?: { content?: string | null } | null;
  }>;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    /** OpenRouter reports total spend (USD) here when usage accounting is on. */
    cost?: number | null;
  } | null;
}

/** The injectable client: anything exposing `chat.completions.create`. */
export interface OpenRouterClientLike {
  chat: {
    completions: {
      create: (args: {
        model: string;
        messages: Array<{ role: "user" | "system" | "assistant"; content: string }>;
        max_tokens: number;
      }) => Promise<ChatCompletionLike>;
    };
  };
}

export interface CallModelParams {
  openrouterId: string;
  prompt: string;
  maxTokens: number;
  /** Optional injected client for testing. Defaults to a real OpenRouter client. */
  client?: OpenRouterClientLike;
  /** USD per prompt token, used to compute cost if usage.cost is absent. */
  promptPriceUsd?: number;
  /** USD per completion token, used to compute cost if usage.cost is absent. */
  completionPriceUsd?: number;
}

export interface CallModelResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

/** Build a real OpenRouter client from the OPENROUTER_API_KEY env var. */
export async function createDefaultClient(): Promise<OpenRouterClientLike> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Export it before running a real generation.",
    );
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });
  return client as unknown as OpenRouterClientLike;
}

/**
 * Call a model through OpenRouter and return text + token + cost accounting.
 *
 * Cost resolution order:
 *   1. usage.cost from the OpenRouter response (preferred — real billed amount).
 *   2. computed from passed per-token prices.
 *   3. 0 if neither is available.
 */
export async function callModel(params: CallModelParams): Promise<CallModelResult> {
  const {
    openrouterId,
    prompt,
    maxTokens,
    promptPriceUsd,
    completionPriceUsd,
  } = params;

  const client = params.client ?? (await createDefaultClient());

  const completion = await client.chat.completions.create({
    model: openrouterId,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  const tokensIn = completion.usage?.prompt_tokens ?? 0;
  const tokensOut = completion.usage?.completion_tokens ?? 0;

  let costUsd: number;
  const reportedCost = completion.usage?.cost;
  if (typeof reportedCost === "number" && !Number.isNaN(reportedCost)) {
    costUsd = reportedCost;
  } else if (
    typeof promptPriceUsd === "number" ||
    typeof completionPriceUsd === "number"
  ) {
    costUsd = tokensIn * (promptPriceUsd ?? 0) + tokensOut * (completionPriceUsd ?? 0);
  } else {
    costUsd = 0;
  }

  return { text, tokensIn, tokensOut, costUsd };
}
