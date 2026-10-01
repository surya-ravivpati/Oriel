import type { PersonaId } from "@/lib/interview/personas";

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
] as const;
export type BotShape = (typeof BOT_SHAPES)[number]["id"];

export interface BotColor { label: string; face: string; shade: string; eye: string; highlight: string; dark?: boolean; glowEyes?: boolean }

export const BOT_COLORS = {
  pearl: { label: "Pearl", face: "#EEEFF2", shade: "#C9CCD4", eye: "#1B1C21", highlight: "#F3D3A1" },
  ivory: { label: "Ivory", face: "#F4EFE3", shade: "#D9D0BD", eye: "#1C1C20", highlight: "#F3D3A1" },
  cream: { label: "Cream", face: "#F6E3C3", shade: "#DEC39A", eye: "#1C1A18", highlight: "#F3D3A1" },
  sand: { label: "Sand", face: "#DCC7A5", shade: "#BFA67E", eye: "#1D1B18", highlight: "#F6DDB0" },
  sage: { label: "Sage", face: "#A3BBA0", shade: "#7F9A7C", eye: "#1B201B", highlight: "#F3D3A1" },
  sky: { label: "Sky", face: "#C2D5E8", shade: "#94B0CB", eye: "#1A1D24", highlight: "#F3D3A1" },
  lilac: { label: "Lilac", face: "#D2C9EC", shade: "#ABA0D0", eye: "#1D1A26", highlight: "#F3D3A1" },
  rose: { label: "Rose", face: "#F1C9C1", shade: "#D3A096", eye: "#221A1A", highlight: "#F6DDB0" },
  graphite: { label: "Graphite", face: "#76787D", shade: "#55575C", eye: "#18191D", highlight: "#E9B872", dark: true },
  midnight: { label: "Midnight", face: "#343947", shade: "#1F232D", eye: "#F2C46D", highlight: "#FFF6E0", dark: true, glowEyes: true },
} satisfies Record<string, BotColor>;
export type BotColorId = keyof typeof BOT_COLORS;

export const BOT_ACCESSORIES = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "headset", label: "Headset" },
  { id: "antenna", label: "Antenna" },
  { id: "tuft", label: "Sprout" },
  { id: "rim", label: "Gold rim" },
] as const;
export type BotAccessory = (typeof BOT_ACCESSORIES)[number]["id"];

export interface AvatarStyle {
  shape: BotShape;
  color: BotColorId;
  accessory: BotAccessory;
  /** What the interviewer calls itself; null keeps the persona's own name. */
  name: string | null;
}

export const DEFAULT_STYLES: Record<PersonaId, AvatarStyle> = {
  warm_recruiter: { shape: "circle", color: "pearl", accessory: "headset", name: null },
  hiring_manager: { shape: "squircle", color: "ivory", accessory: "none", name: null },
  direct_manager: { shape: "hexagon", color: "graphite", accessory: "antenna", name: null },
  skeptic: { shape: "triangle", color: "cream", accessory: "glasses", name: null },
  executive: { shape: "arch", color: "sand", accessory: "rim", name: null },
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

/** The name used in conversation: a custom name whole, a persona's full name by its first word. */
export function callName(displayName: string, style?: { name?: string | null } | null): string {
  return style?.name ? displayName : displayName.split(" ")[0];
}
