import "server-only";
import { HttpError } from "@/lib/api/errors";

const MAX_BYTES = 8 * 1024 * 1024;

/** Extract plain text from an uploaded resume. Supports PDF, DOCX and plain text. */
export async function extractDocumentText(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new HttpError(413, "File is larger than 8 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf") || buf.subarray(0, 4).toString() === "%PDF";
  const isDocx = name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  let text: string;
  if (isPdf) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(pdf, { mergePages: true });
    text = Array.isArray(r.text) ? r.text.join("\n") : r.text;
  } else if (isDocx) {
    if (buf.subarray(0, 2).toString() !== "PK") throw new HttpError(400, "That doesn't look like a valid .docx file");
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    text = buf.toString("utf8");
  } else {
    throw new HttpError(415, "Upload a PDF, DOCX or text file — or paste the text instead");
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 40) throw new HttpError(422, "We couldn't read text from that file. If it's a scanned PDF, paste the text instead.");
  return text;
}
