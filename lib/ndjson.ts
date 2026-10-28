/** Read an NDJSON response line by line. Throws on a non-2xx status with the body as the message. */
export async function readNdjson<T>(res: Response, onEvent: (ev: T) => void): Promise<void> {
  if (!res.ok || !res.body) throw new Error(await res.text());
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as T);
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as T);
}

/** Wait for a long job streamed with `longJobResponse`; resolves with its result or throws its error. */
export async function awaitLongJob<T>(res: Response, onProgress?: (seconds: number) => void): Promise<T> {
  let result: T | undefined;
  let error: string | null = null;
  let finished = false;
  await readNdjson<{ type: "working"; seconds: number } | { type: "done"; result: T } | { type: "error"; message: string }>(res, (ev) => {
    if (ev.type === "working") onProgress?.(ev.seconds);
    else if (ev.type === "done") {
      result = ev.result;
      finished = true;
    } else error = ev.message;
  });
  if (error) throw new Error(error);
  if (!finished) throw new Error("The connection dropped before scoring finished. Reload the page: if the score is there, it went through.");
  return result as T;
}
