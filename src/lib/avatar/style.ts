import { PERSONAS, type PersonaId } from "@/lib/interview/personas";

/**
 * How an interviewer looks and what it's called. Each person can restyle and rename
 * any interviewer; the persona's behaviour (warmth, skepticism, pace, voice) never
 * changes with its look. Shared by the client (editor, Room) and the server (validation).
 */
export const BOT_SHAPES = [
  { id: "squircle", label: "Classic" },
  { id: "circle", label: "Orb" },
  { id: "triangle", label: "Prism" },
  { id: "hexagon", label: "Hex" },
  { id: "pill", label: "Capsule" },
  { id: "diamond", label: "Gem" },
  { id: "arch", label: "Window" },
  { id: "blob", label: "Pebble" },
  { id: "square", label: "Block" },
  { id: "octagon", label: "Octa" },
  { id: "bar", label: "Bar" },
  { id: "egg", label: "Egg" },
] as const;
export type BotShape = (typeof BOT_SHAPES)[number]["id"];

export interface BotColor { label: string; face: string; shade: string; eye: string; highlight: string; dark?: boolean; glowEyes?: boolean }

export const BOT_COLORS = {
  // Flat, muted colours that sit on ink beside ivory, stone and olive. "shade" is the darker
  // partner used for accessories and details, not for lighting.
  pearl: { label: "Pearl", face: "#E7E6E2", shade: "#B9B8B3", eye: "#17171A", highlight: "#F3D3A1" },
  ivory: { label: "Ivory", face: "#F2EDE2", shade: "#C9C1B1", eye: "#151515", highlight: "#F3D3A1" },
  cream: { label: "Cream", face: "#EADBC2", shade: "#C2AF8E", eye: "#1A1816", highlight: "#F3D3A1" },
  sand: { label: "Sand", face: "#CDB894", shade: "#A3906D", eye: "#1B1916", highlight: "#F6DDB0" },
  ochre: { label: "Ochre", face: "#C9A35A", shade: "#9C7C3E", eye: "#1B1812", highlight: "#F6DDB0" },
  clay: { label: "Clay", face: "#B8846B", shade: "#8E624D", eye: "#1C1512", highlight: "#F6DDB0" },
  rose: { label: "Rose", face: "#DDB3A8", shade: "#B48A7F", eye: "#201818", highlight: "#F6DDB0" },
  sage: { label: "Sage", face: "#9DAE95", shade: "#77886F", eye: "#18201A", highlight: "#F3D3A1" },
  olive: { label: "Olive", face: "#7F8A6C", shade: "#5C654D", eye: "#151711", highlight: "#F3D3A1" },
  mist: { label: "Mist", face: "#C6CBCB", shade: "#9BA1A1", eye: "#17191A", highlight: "#F3D3A1" },
  sky: { label: "Sky", face: "#A9BCCB", shade: "#8195A5", eye: "#171B21", highlight: "#F3D3A1" },
  lilac: { label: "Lilac", face: "#BDB4D1", shade: "#958CAB", eye: "#1B1822", highlight: "#F3D3A1" },
  graphite: { label: "Graphite", face: "#6E7075", shade: "#4E5055", eye: "#141518", highlight: "#A3AB8B", dark: true },
  slate: { label: "Slate", face: "#4A5361", shade: "#353C47", eye: "#EDE7DA", highlight: "#FFF6E0", dark: true },
  midnight: { label: "Midnight", face: "#2E323C", shade: "#20232A", eye: "#EDE7DA", highlight: "#FFF6E0", dark: true, glowEyes: true },
} satisfies Record<string, BotColor>;
export type BotColorId = keyof typeof BOT_COLORS;

export const BOT_ACCESSORIES = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "headset", label: "Headset" },
  { id: "antenna", label: "Antenna" },
  { id: "tuft", label: "Sprout" },
  { id: "rim", label: "Outline" },
  { id: "brows", label: "Brows" },
  { id: "freckles", label: "Freckles" },
  { id: "beanie", label: "Beanie" },
  { id: "bow", label: "Bow" },
  { id: "halo", label: "Halo" },
] as const;
export type BotAccessory = (typeof BOT_ACCESSORIES)[number]["id"];

/**
 * Gemini prebuilt voices, each checked against the TTS models Oriel uses. Descriptions are
 * Google's. No genders are assigned — people listen and choose.
 */
export const BOT_VOICES = [
  { id: "Sulafat", label: "Warm" }, { id: "Iapetus", label: "Clear" }, { id: "Alnilam", label: "Firm" }, { id: "Kore", label: "Firm" },
  { id: "Gacrux", label: "Mature" }, { id: "Achird", label: "Friendly" }, { id: "Puck", label: "Upbeat" }, { id: "Charon", label: "Informative" },
  { id: "Aoede", label: "Breezy" }, { id: "Leda", label: "Youthful" }, { id: "Zephyr", label: "Bright" }, { id: "Algenib", label: "Gravelly" },
  { id: "Despina", label: "Smooth" }, { id: "Schedar", label: "Even" }, { id: "Vindemiatrix", label: "Gentle" }, { id: "Sadaltager", label: "Knowledgeable" },
  { id: "Umbriel", label: "Easy-going" }, { id: "Enceladus", label: "Breathy" },
] as const;
export type BotVoice = (typeof BOT_VOICES)[number]["id"];

/** One fixed line for previews, so each voice is synthesised once and then served from cache. */
export const VOICE_SAMPLE = "Thanks for making the time today. Let's start with you: tell me about yourself.";

export interface AvatarStyle {
  shape: BotShape;
  color: BotColorId;
  accessory: BotAccessory;
  /** What the interviewer calls itself; null keeps the persona's own name. */
  name: string | null;
  /** How it sounds; null keeps the persona's own voice. */
  voice?: BotVoice | null;
}

export const DEFAULT_STYLES: Record<PersonaId, AvatarStyle> = {
  warm_recruiter: { shape: "circle", color: "pearl", accessory: "headset", name: null },
  hiring_manager: { shape: "squircle", color: "ivory", accessory: "none", name: null },
  direct_manager: { shape: "hexagon", color: "graphite", accessory: "antenna", name: null },
  skeptic: { shape: "triangle", color: "cream", accessory: "glasses", name: null },
  executive: { shape: "arch", color: "slate", accessory: "rim", name: null },
  peer: { shape: "blob", color: "sage", accessory: "tuft", name: null },
};

export function styleFor(personaId: string, saved?: Partial<AvatarStyle> | null): AvatarStyle {
  const base = DEFAULT_STYLES[personaId as PersonaId] ?? DEFAULT_STYLES.hiring_manager;
  return { ...base, ...(saved ?? {}) };
}

export const NAME_MAX = 24;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'’-]*$/u;

export function cleanName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Why a name can't be used, or null. Names reach the interviewer's prompt and voice, so only plain words. */
export function nameProblem(name: string): string | null {
  if (!name) return null;
  if (name.length > NAME_MAX) return `Keep it to ${NAME_MAX} characters.`;
  if (!NAME_RE.test(name)) return "Use letters, numbers, spaces, apostrophes, hyphens or full stops.";
  return null;
}

/** The voice an interviewer speaks with: the person's choice, else the persona's. */
export function voiceFor(personaId: string, style?: { voice?: string | null } | null): string {
  return style?.voice ?? PERSONAS[personaId as PersonaId]?.voice ?? PERSONAS.hiring_manager.voice;
}

/** The name used in conversation: a custom name whole, a persona's full name by its first word. */
export function callName(displayName: string, style?: { name?: string | null } | null): string {
  return style?.name ? displayName : displayName.split(" ")[0];
}
