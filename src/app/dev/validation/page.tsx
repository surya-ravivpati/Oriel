import { notFound } from "next/navigation";
import { CameraValidation } from "./camera";

export const metadata = { title: "Camera validation" };

/** Development-only harness: runs the on-device face/pose pipeline over labelled fixtures. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CameraValidation />;
}
