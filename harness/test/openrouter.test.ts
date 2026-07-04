import { describe, it, expect } from "vitest";
import { callModel, type OpenRouterClientLike, type ChatCompletionLike } from "../src/openrouter.js";

/** Build a fake client returning a fixed completion and capturing the call args. */
function fakeClient(
  completion: ChatCompletionLike,
  capture?: (args: unknown) => void,
): OpenRouterClientLike {
  return {
    chat: {
      completions: {
        create: async (args) => {
          capture?.(args);
          return completion;
        },
      },
    },
  };
}

describe("callModel", () => {
  it("parses text, tokens, and cost from usage when present", async () => {
    const client = fakeClient({
      choices: [{ message: { content: "<!doctype html><html></html>" } }],
      usage: { prompt_tokens: 12, completion_tokens: 340, cost: 0.00042 },
    });
    const res = await callModel({
      openrouterId: "google/gemini-2.5-flash-lite",
      prompt: "Create Pong as a single self-contained HTML file that runs in a browser.",
      maxTokens: 8000,
      client,
    });
    expect(res.text).toContain("<!doctype html>");
    expect(res.tokensIn).toBe(12);
    expect(res.tokensOut).toBe(340);
    expect(res.costUsd).toBeCloseTo(0.00042, 8);
  });

  it("computes cost from per-token prices when usage.cost is absent", async () => {
    const client = fakeClient({
      choices: [{ message: { content: "hi" } }],
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });
    const res = await callModel({
      openrouterId: "qwen/qwen3-4b",
      prompt: "x",
      maxTokens: 100,
      client,
      promptPriceUsd: 0.000001, // $1 / 1M tokens
      completionPriceUsd: 0.000002, // $2 / 1M tokens
    });
    // 100*1e-6 + 200*2e-6 = 0.0001 + 0.0004 = 0.0005
    expect(res.costUsd).toBeCloseTo(0.0005, 10);
    expect(res.tokensIn).toBe(100);
    expect(res.tokensOut).toBe(200);
  });

  it("prefers reported usage.cost over computed prices", async () => {
    const client = fakeClient({
      choices: [{ message: { content: "hi" } }],
      usage: { prompt_tokens: 100, completion_tokens: 200, cost: 0.99 },
    });
    const res = await callModel({
      openrouterId: "x",
      prompt: "x",
      maxTokens: 1,
      client,
      promptPriceUsd: 0.001,
      completionPriceUsd: 0.001,
    });
    expect(res.costUsd).toBe(0.99);
  });

  it("defaults cost to 0 and tokens to 0 when usage is missing entirely", async () => {
    const client = fakeClient({
      choices: [{ message: { content: "hi" } }],
    });
    const res = await callModel({ openrouterId: "x", prompt: "x", maxTokens: 1, client });
    expect(res.costUsd).toBe(0);
    expect(res.tokensIn).toBe(0);
    expect(res.tokensOut).toBe(0);
  });

  it("returns empty string text when the model returns no content", async () => {
    const client = fakeClient({ choices: [{ message: { content: null } }] });
    const res = await callModel({ openrouterId: "x", prompt: "x", maxTokens: 1, client });
    expect(res.text).toBe("");
  });

  it("forwards model id, prompt, and max_tokens to the client", async () => {
    let seen: any;
    const client = fakeClient(
      { choices: [{ message: { content: "ok" } }] },
      (args) => {
        seen = args;
      },
    );
    await callModel({
      openrouterId: "deepseek/deepseek-chat",
      prompt: "Create Snake as a single self-contained HTML file that runs in a browser.",
      maxTokens: 4096,
      client,
    });
    expect(seen.model).toBe("deepseek/deepseek-chat");
    expect(seen.max_tokens).toBe(4096);
    expect(seen.messages[0]).toEqual({
      role: "user",
      content: "Create Snake as a single self-contained HTML file that runs in a browser.",
    });
  });
});
