import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { authed, HttpError, json, parseBody } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";
import { PLANS } from "@/lib/billing/plans";

const Body = z.object({ plan: z.enum(["free", "sprint", "pro"]) });

/**
 * Payment adapter. ORIEL_PAYMENTS=dev (default outside production) activates the plan
 * immediately with no charge, clearly labelled in the UI. A real processor (Stripe
 * Checkout) plugs in here and activates the plan from its webhook instead.
 */
export const POST = authed(async (req, { user }) => {
  const { plan } = await parseBody(req, Body);
  const mode = process.env.ORIEL_PAYMENTS ?? (process.env.NODE_ENV === "production" ? "stripe" : "dev");
  if (mode !== "dev") throw new HttpError(501, "Payments are not configured yet. Set STRIPE_SECRET_KEY and implement the Stripe adapter.");
  const db = getDb();
  db.update(schema.subscriptions).set({ status: "canceled" }).where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.status, "active"))).run();
  const days = PLANS[plan].limits.periodDays;
  db.insert(schema.subscriptions).values({
    id: newId("sub"), userId: user.id, plan, periodStart: new Date(),
    periodEnd: days ? new Date(Date.now() + days * 86400_000) : null, externalRef: "dev-checkout",
  }).run();
  audit("billing.plan_changed", { userId: user.id, data: { plan, mode } });
  return json({ ok: true, plan, mode });
}, { limit: 10 });
