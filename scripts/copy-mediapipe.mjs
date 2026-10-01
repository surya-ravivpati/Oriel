// Self-host the MediaPipe WASM runtime (copied from node_modules) so the Room
// doesn't depend on a third-party CDN for code execution.
import fs from "node:fs";
import path from "node:path";
const src = path.join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dst = path.join(process.cwd(), "public", "mediapipe");
if (fs.existsSync(src)) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  console.log(`[mediapipe] copied ${fs.readdirSync(dst).length} files to public/mediapipe`);
}
