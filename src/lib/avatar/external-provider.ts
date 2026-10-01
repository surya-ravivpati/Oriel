import type { AvatarProvider, AvatarSession, AvatarSessionConfig } from "./types";

/**
 * Managed real-time avatar vendor adapter (e.g. HeyGen LiveAvatar, Tavus, Anam).
 *
 * Flow: the server exchanges its secret key for a short-lived session token
 * (GET /api/avatar/session), the browser joins the vendor's WebRTC room with that
 * token, sends the interviewer's PCM with sendAudio, and renders the returned video
 * track. Credentials never reach the client.
 *
 * Not configured in this build: createSession throws, and the Room falls back to the
 * on-device LocalAvatarProvider. Wire a vendor here once a contract and keys exist —
 * the business plan recommends measuring latency, idle billing and concurrency on
 * two vendors before committing.
 */
export class ExternalAvatarProvider implements AvatarProvider {
  readonly id = "external";

  async createSession(_config: AvatarSessionConfig): Promise<AvatarSession> {
    const res = await fetch("/api/avatar/session", { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    throw new Error(body?.error ?? "Managed avatar provider is not configured");
  }
  async sendAudio(): Promise<void> {
    throw new Error("not connected");
  }
  async setState(): Promise<void> {
    /* vendors expose limited state control; listening/idle is implicit */
  }
  async endSession(): Promise<void> {}
}
