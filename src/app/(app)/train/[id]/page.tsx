import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/errors";
import { loopView } from "@/server/training/service";
import { TrainingSession } from "@/features/training/TrainingSession";

export const metadata = { title: "Practice" };

export default async function TrainLoopPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let view;
  try {
    view = await loopView(user.id, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  return <TrainingSession initial={view} />;
}
