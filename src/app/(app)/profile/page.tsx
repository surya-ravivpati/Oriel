import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/db/client";
import { activeSubscription, loadEntitlementContext } from "@/lib/billing/entitlement-context";
import { PLANS } from "@/lib/billing/plans";
import { Eyebrow } from "@/components/ui/Card";
import { savedStyles } from "@/server/avatar-styles";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const db = getDb();
  const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get()!;
  const resume = db.select().from(schema.resumes).where(and(eq(schema.resumes.userId, user.id), eq(schema.resumes.isActive, true))).orderBy(desc(schema.resumes.createdAt)).get();
  const jd = db.select().from(schema.jobDescriptions).where(and(eq(schema.jobDescriptions.userId, user.id), eq(schema.jobDescriptions.isActive, true))).orderBy(desc(schema.jobDescriptions.createdAt)).get();
  const consents = db.select().from(schema.consentRecords).where(eq(schema.consentRecords.userId, user.id)).orderBy(desc(schema.consentRecords.createdAt)).limit(12).all();
  const sub = activeSubscription(user.id);
  const ent = loadEntitlementContext(user.id);
  const media = db.select().from(schema.mediaObjects).where(and(eq(schema.mediaObjects.userId, user.id), eq(schema.mediaObjects.status, "complete"))).all();
  return (
    <div>
      <Eyebrow>Profile</Eyebrow>
      <h1 className="mt-3 font-display text-5xl">{profile.name}</h1>
      <p className="mt-2 text-mist-400">{user.email} · {profile.targetRole}</p>
      <ProfileClient
        privacy={{ cameraMetricsEnabled: profile.cameraMetricsEnabled, gazeMetricEnabled: profile.gazeMetricEnabled, postureMetricEnabled: profile.postureMetricEnabled, recordVideo: profile.recordVideo, videoRetentionDays: profile.videoRetentionDays }}
        resume={resume ? { name: resume.fileName ?? "Pasted resume", roles: resume.parsed?.roles.map((r) => `${r.title}${r.organization ? ` · ${r.organization}` : ""}`) ?? [], createdAt: resume.createdAt.toISOString() } : null}
        jd={jd ? { title: jd.parsed?.title ?? "Job description", competencies: jd.parsed?.competencies.map((c) => c.label) ?? [] } : null}
        plan={{ id: ent.plan, name: PLANS[ent.plan].name, periodEnd: sub?.periodEnd?.toISOString() ?? null, sessionsThisWeek: ent.usage.sessionsThisWeek, drillsToday: ent.usage.drillsToday }}
        storedRecordings={media.length}
        consents={consents.map((c) => ({ id: c.id, kind: c.kind, granted: c.granted, version: c.version, at: c.createdAt.toISOString() }))}
        styles={savedStyles(user.id)}
      />
    </div>
  );
}
