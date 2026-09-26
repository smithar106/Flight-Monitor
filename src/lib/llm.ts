// Provider-agnostic LLM client (DeepSeek / Anthropic / OpenAI). Used only for
// natural-language explanation and tool dispatch. Never used to compute metrics.

import { consumeLlmCall } from "./rate-limit";

type Provider = "deepseek" | "anthropic" | "openai";

interface ChatResult {
  content: string | null;
  ms: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResult {
  text: string | null;
  ms: number;
  inputTokens: number;
  outputTokens: number;
}

export function llmProvider(): string {
  return process.env.LLM_PROVIDER ?? "deepseek";
}

function apiKey(): string | null {
  switch (llmProvider()) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "openai":
      return process.env.OPENAI_API_KEY ?? null;
    default:
      return process.env.DEEPSEEK_API_KEY ?? null;
  }
}

export function llmModel(): string {
  switch (llmProvider()) {
    case "anthropic":
      return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
    case "openai":
      return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    default:
      return process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  }
}

export function llmAvailable(): boolean {
  return Boolean(apiKey());
}

// Approximate per-token USD pricing for cost attribution in observability.
const PRICING: Record<string, { input: number; output: number }> = {
  deepseek: { input: 0.00000014, output: 0.00000056 },
  openai: { input: 0.00000015, output: 0.0000006 },
  anthropic: { input: 0.000003, output: 0.000015 },
};

export function llmCost(inputTokens: number, outputTokens: number): number {
  const p = PRICING[llmProvider()] ?? PRICING.deepseek;
  return inputTokens * p.input + outputTokens * p.output;
}

async function chat(
  messages: { role: string; content: string }[],
  opts: { system?: string; maxTokens: number; temperature: number }
): Promise<ChatResult> {
  const key = apiKey();
  const start = Date.now();
  if (!key) return { content: null, ms: 0, inputTokens: 0, outputTokens: 0 };

  // Enforce the monthly cost ceiling at the point of spend. When exhausted, we
  // return null so callers use their deterministic fallback (no 429, no spend).
  if (!consumeLlmCall()) {
    return { content: null, ms: 0, inputTokens: 0, outputTokens: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    if (llmProvider() === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: llmModel(),
          system: opts.system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
        }),
      });
      if (!res.ok) return { content: null, ms: Date.now() - start, inputTokens: 0, outputTokens: 0 };
      const data = await res.json();
      const content = (data.content ?? [])
        .filter((b: { type?: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text)
        .join("\n")
        .trim();
      return {
        content: content || null,
        ms: Date.now() - start,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      };
    }

    // OpenAI-compatible (DeepSeek / OpenAI)
    const base = llmProvider() === "openai" ? "https://api.openai.com" : "https://api.deepseek.com";
    const body: Record<string, unknown> = {
      model: llmModel(),
      messages: opts.system
        ? [{ role: "system", content: opts.system }, ...messages]
        : messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    };
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { content: null, ms: Date.now() - start, inputTokens: 0, outputTokens: 0 };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? null;
    return {
      content: content || null,
      ms: Date.now() - start,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  } catch {
    return { content: null, ms: Date.now() - start, inputTokens: 0, outputTokens: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateText(
  system: string,
  user: string,
  maxTokens = 600,
  temperature = 0.2
): Promise<LlmResult> {
  const r = await chat([{ role: "user", content: user }], { system, maxTokens, temperature });
  return {
    text: r.content,
    ms: r.ms,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
  };
}

function parseJson<T>(text: string): T | null {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

// Asks the LLM to return a single JSON object (used for tool dispatch). Falls
// back to null on any failure so callers can use their deterministic fallback.
export async function generateJson<T>(
  system: string,
  user: string,
  maxTokens = 400
): Promise<T | null> {
  const r = await generateText(system, user, maxTokens, 0);
  if (!r.text) return null;
  return parseJson<T>(r.text);
}
