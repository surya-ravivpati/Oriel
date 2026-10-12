import { BOT_COLORS, styleFor, type AvatarStyle, type BotAccessory, type BotShape } from "@/lib/avatar/style";

export type { BotAccessory, BotShape };

/**
 * The Oriel bot family, drawn flat like a mark: one colour for the face, two solid capsule
 * eyes, no mouth, and at most one accessory, so each interviewer reads at a glance and all
 * belong together. People can restyle any interviewer (lib/avatar/style.ts).
 */
export interface BotLook {
  shape: BotShape;
  face: string; // base face colour
  faceShade: string; // edge shade
  eye: string;
  highlight: string; // eye highlight
  glowEyes: boolean; // lit eyes on dark faces
  accessory: BotAccessory;
  accessoryColor: string;
  blush: number; // 0..1 cheek warmth
}

/** Cheek warmth is temperament, not styling: it stays with the persona whatever it looks like. */
const PERSONA_BLUSH: Record<string, number> = { warm_recruiter: 0.35, hiring_manager: 0.08, peer: 0.12 };

export function lookFor(personaId: string, saved?: Partial<AvatarStyle> | null): BotLook {
  const s = styleFor(personaId, saved);
  const c = BOT_COLORS[s.color] ?? BOT_COLORS.ivory;
  const dark = "dark" in c && !!c.dark;
  const accessoryColor = {
    none: c.shade,
    glasses: dark ? "#E6D9C3" : "#5B4A36",
    headset: "#D5D8DE",
    antenna: dark ? "#8A8F9C" : c.shade,
    tuft: s.color === "sage" || s.color === "olive" ? "#5C654D" : "#8C957A",
    rim: dark ? "#C9C1B1" : c.shade,
    brows: c.eye,
    freckles: c.shade,
    beanie: dark ? "#8C957A" : "#555C4A",
    bow: dark ? "#DDB3A8" : "#B8846B",
    halo: "#C9A35A",
  }[s.accessory];
  return {
    shape: s.shape, face: c.face, faceShade: c.shade, eye: c.eye, highlight: c.highlight,
    glowEyes: "glowEyes" in c && !!c.glowEyes, accessory: s.accessory, accessoryColor, blush: PERSONA_BLUSH[personaId] ?? 0,
  };
}
