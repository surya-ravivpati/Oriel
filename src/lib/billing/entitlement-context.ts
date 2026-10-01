import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { PLANS, type PlanId } from "./plans";
import type { EntitlementContext } from "./entitlements";

const DAY = 24 * 60 * 60 * 1000;

export function activeSubscription(userId: string) {
  const sub = getDb().select().from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, "active")))
    .orderBy(desc(schema.subscriptions.createdAt)).get();
  if (!sub) return null;
  if (sub.periodEnd && sub.periodEnd.getTime() < Date.now()) return null;
  return sub;
}

export function loadEntitlementContext(userId: string): EntitlementContext {
  const db = getDb();
  const sub = activeSubscription(userId);
  const plan = (sub?.plan ?? "free") as PlanId;
  const periodDays = PLANS[plan].limits.periodDays;
  const periodStart = sub ? (periodDays ? sub.periodStart : new Date(Date.now() - 30 * DAY)) : new Date(Date.now() - 30 * DAY);
  const sum = (kind: string, since: Date) =>
    db.select({ q: sql<number>`coalesce(sum(${schema.usageRecords.quantity}), 0)` }).from(schema.usageRecords)
      .where(and(eq(schema.usageRecords.userId, userId), eq(schema.usageRecords.kind, kind), gte(schema.usageRecords.createdAt, since))).get()?.q ?? 0;
  return {
    plan,
    planActive: true,
    usage: {
      sessionsThisWeek: sum("sessions", new Date(Date.now() - 7 * DAY)),
      managedAvatarMinutesThisPeriod: sum("managed_avatar_minutes", periodStart),
      drillsToday: sum("drills", new Date(Date.now() - DAY)),
    },
  };
}
