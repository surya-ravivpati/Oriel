/**
 * Unit prices in USD. Sourced from https://ai.google.dev/gemini-api/docs/pricing on
 * 2026-09-29 (paid tier, promotional rates through 2026-12-31). Anthropic from the
 * Claude API model table. Override any entry with ORIEL_PRICE_<KEY>=<usd per unit>.
 */
export const PRICES: Record<string, { perMillionInput?: number; perMillionOutput?: number; perMinute?: number; perGbMonth?: number }> = {
  "gemini-3.1-flash-lite": { perMillionInput: 0.25, perMillionOutput: 1.5 },
  "gemini-3.5-flash-lite": { perMillionInput: 0.3, perMillionOutput: 2.5 },
  "gemini-3.8-flash": { perMillionInput: 0.75, perMillionOutput: 3.75 },
  "gemini-3.8-flash-tts": { perMillionInput: 0.5, perMillionOutput: 9.0 },
  "gemini-3.8-flash-lite-tts": { perMillionInput: 0.5, perMillionOutput: 6.0 },
  "gemini-3.5-transcribe": { perMillionInput: 2.0, perMillionOutput: 12.0 },
  "claude-opus-5": { perMillionInput: 5, perMillionOutput: 25 },
  "claude-sonnet-5": { perMillionInput: 2, perMillionOutput: 10 },
  "claude-haiku-4-5": { perMillionInput: 1, perMillionOutput: 5 },
  // Managed avatar vendors (business plan, Sept 2026 index): per active minute.
  "avatar-managed-premium": { perMinute: 0.32 },
  "avatar-managed-low": { perMinute: 0.11 },
  "avatar-local": { perMinute: 0 },
  "storage-local": { perGbMonth: 0.023 },
};

export function tokenCost(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICES[model];
  if (!p) return 0;
  const envIn = Number(process.env[`ORIEL_PRICE_${model.replace(/\W/g, "_").toUpperCase()}_IN`]);
  const envOut = Number(process.env[`ORIEL_PRICE_${model.replace(/\W/g, "_").toUpperCase()}_OUT`]);
  const inRate = Number.isFinite(envIn) && envIn > 0 ? envIn : p.perMillionInput ?? 0;
  const outRate = Number.isFinite(envOut) && envOut > 0 ? envOut : p.perMillionOutput ?? 0;
  return (inputTokens / 1e6) * inRate + (outputTokens / 1e6) * outRate;
}
