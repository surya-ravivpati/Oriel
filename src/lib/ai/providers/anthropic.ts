import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ProviderError, type GenerateJsonRequest, type GenerateTextRequest, type LanguageModelProvider } from "./types";

/**
 * Optional Claude adapter. Enabled with ORIEL_LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY.
 * Realtime turns run at low effort to protect conversational latency.
 */
export const ANTHROPIC_MODELS = {
  realtime: process.env.ANTHROPIC_REALTIME_MODEL ?? "claude-opus-5",
  analysis: process.env.ANTHROPIC_ANALYSIS_MODEL ?? "claude-opus-5",
};

export class AnthropicLanguageModel implements LanguageModelProvider {
  readonly id = "anthropic";
  readonly isMock = false;
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 1 });
  }

  async generateText(req: GenerateTextRequest) {
    const model = ANTHROPIC_MODELS[req.tier];
    const t0 = performance.now();
    try {
      const res = await this.client.messages.create({
        model, max_tokens: req.maxTokens ?? 400, system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { effort: req.tier === "realtime" ? "low" : "medium" },
      }, { timeout: req.timeoutMs ?? 10000 });
      if (res.stop_reason === "refusal") throw new ProviderError("anthropic", "refusal");
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      if (!text) throw new ProviderError("anthropic", "empty response", true);
      return { text, usage: { model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }, latencyMs: performance.now() - t0 };
    } catch (err) {
      throw wrap(err);
    }
  }

  async generateJson<T>(req: GenerateJsonRequest<T>) {
    const model = ANTHROPIC_MODELS[req.tier];
    const t0 = performance.now();
    try {
      const res = await this.client.messages.parse({
        model, max_tokens: req.maxTokens ?? 8000, system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: { format: zodOutputFormat(req.schema as never), effort: "low" },
      }, { timeout: req.timeoutMs ?? 60000 });
      if (res.stop_reason === "refusal") throw new ProviderError("anthropic", "refusal");
      const parsed = req.schema.safeParse(res.parsed_output);
      if (!parsed.success) throw new ProviderError("anthropic", "schema validation failed", true);
      return { data: parsed.data, usage: { model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }, latencyMs: performance.now() - t0 };
    } catch (err) {
      throw wrap(err);
    }
  }
}

function wrap(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof Anthropic.RateLimitError) return new ProviderError("anthropic", "rate limited", true, 429);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError("anthropic", "timeout", true);
  if (err instanceof Anthropic.APIConnectionError) return new ProviderError("anthropic", "connection error", true);
  if (err instanceof Anthropic.APIError) return new ProviderError("anthropic", err.message, (err.status ?? 500) >= 500, err.status);
  return new ProviderError("anthropic", String(err));
}
