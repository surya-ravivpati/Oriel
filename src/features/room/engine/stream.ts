/** Read a newline-delimited JSON response, calling onEvent for each line as it arrives. */
export async function readNdjson<T>(res: Response, onEvent: (e: T) => void | Promise<void>): Promise<void> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) await onEvent(JSON.parse(line) as T);
    }
  }
  if (buf.trim()) await onEvent(JSON.parse(buf) as T);
}
