import { notFound } from "next/navigation";
import { AvatarLab } from "./lab";

export const metadata = { title: "Avatar lab" };

/** Development-only tuning page for the interviewer's face. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AvatarLab />;
}
