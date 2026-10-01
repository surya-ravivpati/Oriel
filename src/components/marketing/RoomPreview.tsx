"use client";
/* eslint-disable react-hooks/immutability -- AvatarStore is an external mutable object read by the render loop, not React state. */
import { useEffect, useMemo } from "react";
import { BotAvatar } from "@/components/avatar/BotAvatar";
import { AvatarStore } from "@/lib/avatar/store";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";

/** A live three-person panel for the landing page: the speaker rotates, the others watch. */
export function RoomPreview() {
  const store = useMemo(() => {
    const s = new AvatarStore();
    s.pressure = 3;
    s.stillness = 0.4;
    return s;
  }, []);
  const seats = useMemo(() => (["hiring_manager", "skeptic", "peer"] as PersonaId[]).map((id, seat) => ({
    seat, personaId: id, name: PERSONAS[id].name, accent: "#E9B872", expressiveness: PERSONAS[id].expressiveness, warmth: PERSONAS[id].warmth, skepticism: PERSONAS[id].skepticism,
  })), []);
  useEffect(() => {
    let i = 0;
    const t0 = performance.now();
    store.level = () => (store.mode === "speaking" ? Math.max(0, Math.sin((performance.now() - t0) / 95) * 0.45 + Math.sin((performance.now() - t0) / 41) * 0.25) : 0);
    store.setMode("speaking", 0);
    const id = setInterval(() => {
      i++;
      const seat = i % 3;
      if (i % 2) { store.setMode("listening", seat); store.candidateSpeaking = true; }
      else { store.candidateSpeaking = false; store.setMode("speaking", seat); if (seat === 1) store.fireCue("brow_raise", 1); }
    }, 2600);
    return () => clearInterval(id);
  }, [store]);
  return <BotAvatar store={store} seats={seats} className="absolute inset-x-0 top-[12%] bottom-[22%]" />;
}
