import { getAnthropic, EFFORT, MODEL } from "@/lib/anthropic";
import type { DrillScore } from "@/lib/types";

/** A grading failure the user can act on (retry), as opposed to a bug. */
export class GraderError extends Error {}

function parseScore(text: string): DrillScore {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as DrillScore;
  if (!Array.isArray(obj.rows)) throw new Error("grader returned no rows");
  obj.total = obj.rows.reduce((s, r) => s + Number(r.score || 0), 0);
  return obj;
}

/**
 * Run the grader and parse its JSON. The request is streamed: a high-effort grade of a long
 * transcript takes a couple of minutes, and a streamed request keeps the upstream connection busy
 * for the whole generation instead of sitting idle until the answer is complete.
 */
export async function gradeTranscript(system: string, userContent: string): Promise<DrillScore> {
  const s = getAnthropic().messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { effort: EFFORT.grader },
    messages: [{ role: "user", content: userContent }],
  });
  const final = await s.finalMessage();
  if (final.stop_reason === "refusal") throw new GraderError("The grader declined to score this transcript.");
  if (final.stop_reason === "max_tokens") throw new GraderError("The grader ran out of room before finishing. Try again.");
  const text = final.content
    .filter((b): b is { type: "text"; text: string; citations: null } => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return parseScore(text);
  } catch (e) {
    throw new GraderError(`Could not read the grader's output: ${e instanceof Error ? e.message : String(e)}. Try again.`);
  }
}

export type LongJobEvent<T> = { type: "working"; seconds: number } | { type: "done"; result: T } | { type: "error"; message: string };

/**
 * An NDJSON response that sends a heartbeat every few seconds while `work` runs, then its result.
 * A response that sends nothing for a minute or so gets dropped by browsers and proxies; the
 * heartbeat keeps the connection open for as long as the function is allowed to run. `work` is
 * not cancelled if the client goes away, so a grade that was started always finishes and saves.
 */
export function longJobResponse<T>(work: () => Promise<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (o: LongJobEvent<T>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
        } catch {
          open = false; // client disconnected; keep working, stop writing
        }
      };
      const startedAt = Date.now();
      emit({ type: "working", seconds: 0 });
      const beat = setInterval(() => emit({ type: "working", seconds: Math.round((Date.now() - startedAt) / 1000) }), 5000);
      try {
        emit({ type: "done", result: await work() });
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        clearInterval(beat);
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
