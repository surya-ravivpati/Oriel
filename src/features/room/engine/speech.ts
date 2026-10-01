/**
 * Live transcription with the browser's SpeechRecognition (Chrome/Edge/Safari).
 * Used for the conversation because it is instant. It tends to drop "um"/"uh", so
 * the Read uses the server transcription of each answer's audio when available.
 */
type SR = {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};

function ctor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class LiveTranscriber {
  static supported() {
    return !!ctor();
  }

  private rec: SR | null = null;
  private finals: string[] = [];
  private interim = "";
  private active = false;
  private endResolve: (() => void) | null = null;
  lastResultAt = 0;
  onUpdate: ((text: string) => void) | null = null;
  onFatal: ((kind: string) => void) | null = null;

  /** True when the recogniser has no unfinished (interim) words. */
  get settled() {
    return this.interim === "" && this.finals.length > 0;
  }

  get text() {
    return `${this.finals.join(" ")} ${this.interim}`.replace(/\s+/g, " ").trim();
  }

  start() {
    const C = ctor();
    if (!C) return;
    this.finals = [];
    this.interim = "";
    this.active = true;
    this.spawn(C);
  }

  private spawn(C: new () => SR) {
    const rec = new C();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
    rec.maxAlternatives = 1;
    const base = this.finals.length;
    rec.onresult = (e) => {
      const fin: string[] = [];
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin.push(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      this.finals = [...this.finals.slice(0, base), ...fin];
      this.interim = interim.trim();
      this.lastResultAt = performance.now();
      this.onUpdate?.(this.text);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        this.active = false;
        this.onFatal?.(e.error);
      }
    };
    rec.onend = () => {
      if (this.interim) { this.finals.push(this.interim); this.interim = ""; }
      if (this.active) {
        // Chrome ends sessions after silences or network hiccups — keep listening.
        try { this.spawn(C); } catch { /* ignore */ }
      } else {
        this.endResolve?.();
        this.endResolve = null;
      }
    };
    this.rec = rec;
    try { rec.start(); } catch { /* already started */ }
  }

  /** Stop and wait briefly for trailing final results (no wait when already settled). */
  stop(): Promise<string> {
    this.active = false;
    if (!this.rec) return Promise.resolve(this.text);
    if (this.settled) {
      const t = this.text;
      try { this.rec.abort(); } catch { /* ignore */ }
      return Promise.resolve(t);
    }
    return new Promise((resolve) => {
      const done = () => resolve(this.text);
      this.endResolve = done;
      try { this.rec!.stop(); } catch { done(); }
      setTimeout(done, 700);
    });
  }

  abort() {
    this.active = false;
    try { this.rec?.abort(); } catch { /* ignore */ }
  }
}
