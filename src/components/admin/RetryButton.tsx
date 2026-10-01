"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RetryButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
      setBusy(true);
      await fetch(`/api/admin/sessions/${sessionId}/retry`, { method: "POST" });
      setTimeout(() => { setBusy(false); router.refresh(); }, 1500);
    }}>Re-run analysis</Button>
  );
}
