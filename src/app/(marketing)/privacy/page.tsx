import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { CONSENT_COPY, CONSENT_VERSION } from "@/lib/privacy/consent";

export const metadata = { title: "Privacy & biometric policy" };

const RETENTION: [string, string, string][] = [
  ["Raw session recording (your video and audio, plus the interviewer's voice)", "Your setting: 1, 7, 30 (default) or 90 days", "Deleted automatically at the end of the period, or immediately when you delete the session"],
  ["Frame-level derived signals (camera engagement estimates, posture numbers, loudness/pitch timelines)", "Same as the raw recording", "Deleted with the raw recording; deleted at once if you withdraw camera consent"],
  ["Face and body landmarks", "Never stored", "Computed in your browser, reduced to a few numbers, and discarded frame by frame"],
  ["Answer audio sent for transcription", "Not stored by Oriel", "Transcribed by our speech provider and discarded"],
  ["Transcript, the Read (aggregate metrics), Playback coaching", "Until you delete the session or your account", "Session delete or account delete"],
  ["Resume and job description", "Until you replace or delete them, or delete your account", "Account delete"],
  ["Account", "While active; deleted after 3 years without sign-in", "One-click account deletion in Profile"],
  ["Consent records and security audit log", "As required to demonstrate consent (no interview content)", "Kept after account deletion without personal content"],
];

const PROCESSORS: [string, string, string][] = [
  ["Google (Gemini API)", "Interviewer language, voice synthesis, answer transcription, document parsing, coaching", "Your answers' text and answer audio (for transcription); resume and job description text"],
  ["Your browser's speech service (Chrome)", "Live captions during the interview, when your browser provides them", "Microphone audio, processed by the browser vendor"],
  ["Google (MediaPipe model files)", "Download of the on-device face and pose models", "None — no user data is sent"],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <Link href="/"><Logo /></Link>
      <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.18em] text-signal-warn">Draft — pending review by privacy counsel</p>
      <h1 className="mt-3 font-display text-5xl leading-tight">Privacy &amp; biometric policy</h1>
      <p className="mt-4 text-mist-300">Oriel is a practice tool. It is not used by employers to screen candidates, and it never feeds you answers during a real interview. Consent version {CONSENT_VERSION}.</p>

      <Section title="The short version">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your interviewer is an AI. Every session says so at the start.</li>
          <li>Camera and microphone turn on only after a separate consent screen for each session.</li>
          <li>Face and body landmarks are processed on your device and never leave it. We keep only derived numbers.</li>
          <li>We never sell biometric data or any other data, and never share your results with an employer or school without your explicit consent.</li>
          <li>You can delete any session, or your whole account, at any time.</li>
        </ul>
      </Section>

      <Section title="What we collect and why" id="collect">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Account:</b> email, a salted scrypt hash of your password, and your profile (name, target role, preferences).</li>
          <li><b>Documents:</b> the resume and job description you provide, so the interviewer asks relevant questions. We extract only what is written.</li>
          <li><b>Interview:</b> what you say (transcribed), the interviewer&apos;s questions, timing, and — if you allow recording — an encrypted recording for Playback.</li>
          <li><b>Delivery signals:</b> from audio, loudness and pitch timelines (for pace, pauses and vocal variety); from the camera, if you allow it, estimates of where your head and eyes point and how your upper body moves.</li>
          <li><b>Operational:</b> usage, costs, latency and errors, used to run and improve the service.</li>
        </ul>
      </Section>

      <Section title="Biometric information notice" id="biometric">
        <p>Some laws (for example Illinois&apos; Biometric Information Privacy Act, Texas&apos; CUBI, and Washington&apos;s biometric law) regulate face geometry and voiceprints. We designed Oriel to avoid collecting them:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li><b>Face geometry:</b> the face and pose models run in your browser. Landmarks are reduced each frame to a handful of numbers (such as &ldquo;facing the lens: 0.8&rdquo;) and discarded. We do not create or store face templates and cannot identify you from what we keep.</li>
          <li><b>Voice:</b> we analyse loudness, pitch movement and timing, and transcribe your words. We do not create or store voiceprints and do not identify speakers.</li>
          <li><b>Written release:</b> before any camera-derived signal is computed, we ask for your electronic signature on this release, and record the exact wording, its version and the time:</li>
        </ul>
        <blockquote className="mt-3 border-l-2 border-lume/50 pl-4 text-mist-200">{CONSENT_COPY.camera_metrics} {CONSENT_COPY.camera_metrics_release}</blockquote>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li><b>Purpose:</b> only to give you feedback on your own practice. Never to identify you, never for hiring decisions, never for advertising.</li>
          <li><b>No sale, no disclosure:</b> we never sell, lease, trade or otherwise profit from this data, and never disclose it except to you, or where legally required.</li>
          <li><b>Opt out any time:</b> switch off camera-based signals, gaze, or posture in Privacy settings. Withdrawing deletes the stored camera-derived timelines. You can still practice.</li>
          <li><b>Never measured:</b> attractiveness, age, race, emotion, personality, accent.</li>
        </ul>
      </Section>

      <Section title="Retention schedule" id="retention">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-mist-400"><tr><th className="py-2 pr-4 font-normal">Data</th><th className="pr-4 font-normal">Kept for</th><th className="font-normal">How it is destroyed</th></tr></thead>
            <tbody>{RETENTION.map(([a, b, c]) => <tr key={a} className="border-t border-white/10 align-top"><td className="py-3 pr-4 text-mist-100">{a}</td><td className="pr-4">{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title="Who processes data for us" id="processors">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-mist-400"><tr><th className="py-2 pr-4 font-normal">Processor</th><th className="pr-4 font-normal">Purpose</th><th className="font-normal">Data involved</th></tr></thead>
            <tbody>{PROCESSORS.map(([a, b, c]) => <tr key={a} className="border-t border-white/10 align-top"><td className="py-3 pr-4 text-mist-100">{a}</td><td className="pr-4">{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title="Security">
        <p>Recordings are encrypted at rest with AES-256-GCM under per-user keys and are streamed only to their owner through short-lived signed links. Provider keys stay on our servers. Access is rate-limited and audit-logged.</p>
      </Section>

      <Section title="Your choices and rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>Download everything we store about you (Profile → Your data → Download).</li>
          <li>Delete a session (Playback) or your account (Profile). Deletion is immediate and permanent.</li>
          <li>Change retention, recording, and camera-signal settings at any time (Profile → Privacy). Changes are logged as consent records.</li>
        </ul>
      </Section>

      <Section title="Campus and employer programs">
        <p>Where a school or organisation provides Oriel seats, they see aggregate reporting only. Individual results are never shared without your explicit, separate consent.</p>
      </Section>

      <p className="mt-16 text-sm text-mist-400">Questions: privacy@oriel.example. This policy is a working draft prepared for review by privacy counsel and is not legal advice.</p>
    </main>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-10 leading-relaxed text-mist-300">
      <h2 className="mb-4 font-display text-3xl text-mist-100">{title}</h2>
      {children}
    </section>
  );
}
