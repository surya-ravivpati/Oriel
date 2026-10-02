import { z } from "zod";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import { BOT_ACCESSORIES, BOT_COLORS, BOT_SHAPES, BOT_VOICES, cleanName, nameProblem, type BotAccessory, type BotColorId, type BotShape, type BotVoice } from "./style";

export const personaIdSchema = z.enum(Object.keys(PERSONAS) as [PersonaId, ...PersonaId[]]);

export const voiceSchema = z.enum(BOT_VOICES.map((v) => v.id) as [BotVoice, ...BotVoice[]]);

export const avatarStyleSchema = z.object({
  shape: z.enum(BOT_SHAPES.map((s) => s.id) as [BotShape, ...BotShape[]]),
  color: z.enum(Object.keys(BOT_COLORS) as [BotColorId, ...BotColorId[]]),
  accessory: z.enum(BOT_ACCESSORIES.map((a) => a.id) as [BotAccessory, ...BotAccessory[]]),
  voice: z.enum(BOT_VOICES.map((v) => v.id) as [BotVoice, ...BotVoice[]]).nullable().default(null),
  name: z.string().max(80).nullable()
    .transform((v) => (v === null ? null : cleanName(v) || null))
    .superRefine((v, ctx) => {
      const problem = v === null ? null : nameProblem(v);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
});
