import type { z } from "zod";

/**
 * Provider contracts. The application depends only on these interfaces; vendors live
 * behind adapters chosen in registry.ts and can be swapped by environment variables.
 */

export interface LlmUsage { model: string; inputTokens: number; outputTokens: number }

export type ModelTier = "realtime" | "analysis";

export interface ChatMessage { role: "user" | "assistant"; content: string }

export interface GenerateTextRequest {
  tier: ModelTier;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface GenerateJsonRequest<T> {
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LanguageModelProvider {
  readonly id: string;
  /** True for development mocks — surfaced in the UI and admin console. */
  readonly isMock: boolean;
  generateText(req: GenerateTextRequest): Promise<{ text: string; usage: LlmUsage; latencyMs: number }>;
  /** Optional token streaming, used to start speech on the first sentence. */
  streamText?(req: GenerateTextRequest): AsyncGenerator<string, { usage: LlmUsage; firstTokenMs: number | null }>;
  generateJson<T>(req: GenerateJsonRequest<T>): Promise<{ data: T; usage: LlmUsage; latencyMs: number }>;
}

export interface SpeechChunk { pcm: Buffer; sampleRate: number }

export interface TextToSpeechProvider {
  readonly id: string;
  readonly isMock: boolean;
  /** Streams 16-bit little-endian mono PCM. */
  streamSpeech(req: { text: string; voice: string; style?: string; timeoutMs?: number }): AsyncGenerator<SpeechChunk, { usage: LlmUsage | null }>;
}

export interface TranscriptionResult { text: string; words: { w: string; s: number; e: number }[] | null; usage: LlmUsage | null; latencyMs: number }

export interface SpeechToTextProvider {
  readonly id: string;
  readonly isMock: boolean;
  /** Server-side transcription of a recorded answer. Live recognition runs in the browser. */
  transcribe(req: { audio: Buffer; mimeType: string; timeoutMs?: number }): Promise<TranscriptionResult>;
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public retryable = false, public status?: number) {
    super(`[${provider}] ${message}`);
  }
}
