import "server-only";
import { AnthropicLanguageModel } from "./anthropic";
import { GeminiLanguageModel, GeminiSpeechToText, GeminiTextToSpeech } from "./gemini";
import { BrowserFallbackTextToSpeech, MockLanguageModel, NoServerSpeechToText } from "./mock";
import type { LanguageModelProvider, SpeechToTextProvider, TextToSpeechProvider } from "./types";

/**
 * Provider selection. Each capability is chosen independently:
 *   ORIEL_LLM_PROVIDER = gemini | anthropic | mock      (default: first with credentials)
 *   ORIEL_TTS_PROVIDER = gemini | browser               (default: gemini if key)
 *   ORIEL_STT_PROVIDER = gemini | browser               (default: gemini if key)
 */
let llm: LanguageModelProvider | null = null;
let tts: TextToSpeechProvider | null = null;
let stt: SpeechToTextProvider | null = null;

export function getLanguageModel(): LanguageModelProvider {
  if (llm) return llm;
  const pref = process.env.ORIEL_LLM_PROVIDER;
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if ((pref === "anthropic" || (!pref && !gemini)) && anthropic) llm = new AnthropicLanguageModel(anthropic);
  else if (pref !== "mock" && gemini) llm = new GeminiLanguageModel(gemini);
  else llm = new MockLanguageModel();
  return llm;
}

export function getTextToSpeech(): TextToSpeechProvider {
  if (tts) return tts;
  const key = process.env.GEMINI_API_KEY;
  tts = process.env.ORIEL_TTS_PROVIDER !== "browser" && key ? new GeminiTextToSpeech(key) : new BrowserFallbackTextToSpeech();
  return tts;
}

export function getSpeechToText(): SpeechToTextProvider {
  if (stt) return stt;
  const key = process.env.GEMINI_API_KEY;
  stt = process.env.ORIEL_STT_PROVIDER !== "browser" && key ? new GeminiSpeechToText(key) : new NoServerSpeechToText();
  return stt;
}

export function providerStatus() {
  const l = getLanguageModel();
  const t = getTextToSpeech();
  const s = getSpeechToText();
  return { llm: l.id, llmMock: l.isMock, tts: t.id, ttsMock: t.isMock, stt: s.id, sttMock: s.isMock };
}

/** Test hook. */
export function setProvidersForTesting(p: { llm?: LanguageModelProvider; tts?: TextToSpeechProvider; stt?: SpeechToTextProvider }) {
  if (p.llm) llm = p.llm;
  if (p.tts) tts = p.tts;
  if (p.stt) stt = p.stt;
}
