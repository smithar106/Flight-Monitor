// Minimal DeepSeek chat-completions client (OpenAI-compatible). Used only for
// natural-language explanation. Never used to compute metrics.

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export function llmAvailable(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export interface LlmResult {
  text: string | null;
  ms: number;
  inputTokens: number;
  outputTokens: number;
}

export async function generateText(
  system: string,
  user: string,
  maxTokens = 600,
  temperature = 0.2
): Promise<LlmResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  const start = Date.now();
  if (!key) {
    return { text: null, ms: 0, inputTokens: 0, outputTokens: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      return { text: null, ms: Date.now() - start, inputTokens: 0, outputTokens: 0 };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return {
      text: content && content.length > 0 ? content : null,
      ms: Date.now() - start,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  } catch {
    return { text: null, ms: Date.now() - start, inputTokens: 0, outputTokens: 0 };
  } finally {
    clearTimeout(timer);
  }
}
