"use client";
/* eslint-disable react-hooks/immutability -- AvatarStore is an external mutable object read by the render loop, not React state. */
import { useEffect, useMemo } from "react";
import { BotAvatar } from "@/components/avatar/BotAvatar";
import { AvatarStore } from "@/lib/avatar/store";
import { PERSONAS } from "@/lib/interview/personas";

/** The hero interviewer: listening, with the occasional thought and nod. No audio. */
export function HeroInterviewer() {
  const store = useMemo(() => {
    const s = new AvatarStore();
    s.stillness = 0.45;
    s.pressure = 3;
    return s;
  }, []);
  const seats = useMemo(() => [{ seat: 0, personaId: "skeptic", name: PERSONAS.skeptic.name, accent: "#E9B872", expressiveness: 0.45, warmth: 0.2, skepticism: 0.75 }], []);
  useEffect(() => {
    store.setMode("listening");
    store.candidateSpeaking = true;
    let i = 0;
    const script = [() => store.fireCue("brow_raise"), () => { store.setMode("thinking"); setTimeout(() => store.setMode("listening"), 1400); }, () => store.fireCue("nod"), () => store.fireCue("lean_in")];
    const id = setInterval(() => script[i++ % script.length](), 4200);
    return () => clearInterval(id);
  }, [store]);
  return <BotAvatar store={store} seats={seats} className="absolute inset-0" />;
}
