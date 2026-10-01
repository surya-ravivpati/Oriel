/** Server boot: start the retention sweeper (raw video is deleted when it passes retention). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { sweepExpiredMedia, finalizeAbandonedSessions, deleteInactiveAccounts } = await import("./server/privacy/retention");
  const run = () => {
    try { sweepExpiredMedia(); } catch (err) { console.error("[retention]", err); }
    finalizeAbandonedSessions().catch((err) => console.error("[sessions]", err));
    deleteInactiveAccounts().catch((err) => console.error("[accounts]", err));
  };
  setTimeout(run, 5_000);
  setInterval(run, 10 * 60_000).unref?.();
}
