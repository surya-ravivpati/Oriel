import fs from "node:fs";
import path from "node:path";

/** Development-only: serves bias-audit fixtures from tests/validation/faces. Disabled in production. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/^[\w-]+\.(png|json)$/.test(name)) return new Response("Bad name", { status: 400 });
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "tests", "validation", "faces", name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(file)), { headers: { "content-type": name.endsWith(".png") ? "image/png" : "application/json", "cache-control": "no-store" } });
}
