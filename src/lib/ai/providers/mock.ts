import { ProviderError, type LanguageModelProvider, type SpeechToTextProvider, type TextToSpeechProvider, type SpeechChunk, type LlmUsage } from "./types";

/**
 * Development mocks, used only when no provider credentials are configured.
 * They never fabricate AI output: generateText/generateJson throw so callers fall
 * back to their deterministic (template / heuristic) paths, which label their output
 * as `source: "heuristic"`. The UI shows a "mock providers" badge when these are active.
 */
export class MockLanguageModel implements LanguageModelProvider {
  readonly id = "mock";
  readonly isMock = true;
  async generateText(): Promise<never> {
    throw new ProviderError("mock", "no language model configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY)");
  }
  async generateJson(): Promise<never> {
    throw new ProviderError("mock", "no language model configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY)");
  }
}

/** No server TTS: the Room falls back to the browser's speechSynthesis voice. */
export class BrowserFallbackTextToSpeech implements TextToSpeechProvider {
  readonly id = "browser-speech-synthesis";
  readonly isMock = true;
  async *streamSpeech(): AsyncGenerator<SpeechChunk, { usage: LlmUsage | null }> {
    throw new ProviderError("browser-speech-synthesis", "server TTS not configured; client should use speechSynthesis");
  }
}

/** No server STT: the live browser transcript is kept as the record. */
export class NoServerSpeechToText implements SpeechToTextProvider {
  readonly id = "browser-only";
  readonly isMock = true;
  async transcribe(): Promise<never> {
    throw new ProviderError("browser-only", "server transcription not configured");
  }
}
