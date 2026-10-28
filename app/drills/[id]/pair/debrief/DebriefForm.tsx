"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/Shell";
import { awaitLongJob } from "@/lib/ndjson";

export function DebriefForm(props: { drillId: number; initialTranscript: string; initialLink: string; sellerName: string; buyerName: string }) {
  const router = useRouter();
  const [transcript, setTranscript] = useState(props.initialTranscript);
  const [link, setLink] = useState(props.initialLink);
  const [busy, setBusy] = useState(false);
  const [scoringSeconds, setScoringSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (transcript.trim().length < 50) {
      setError("Paste the transcript first (at least a few lines).");
      return;
    }
    if (!confirm("Score this drill? The transcript is final once graded.")) return;
    setBusy(true);
    setScoringSeconds(0);
    setError(null);
    try {
      const res = await fetch("/api/pair-debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drillId: props.drillId, transcript, link: link.trim() || null }),
      });
      // A plain JSON reply means the drill was already scored; otherwise it is a heartbeat stream.
      if (res.headers.get("content-type")?.includes("application/json")) {
        if (!res.ok) throw new Error(await res.text());
      } else {
        await awaitLongJob(res, setScoringSeconds);
      }
      router.push(`/drills/${props.drillId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-sm font-semibold" htmlFor="transcript">
          Transcript
        </label>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={18}
          disabled={busy}
          placeholder={`${props.sellerName}: Hi Dana, this is ...\n${props.buyerName}: Sorry, who's this?`}
          className="w-full resize-y rounded border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
        <label className="text-sm font-semibold" htmlFor="link">
          Wispr share link <span className="font-normal text-muted">(optional, stored as text)</span>
        </label>
        <input
          id="link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={busy}
          placeholder="https://notes.wisprflow.ai/shared/…"
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="rounded bg-warn-soft px-3 py-2 text-xs text-warn">{error}</p>}
        <div>
          <button disabled={busy} className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {busy ? `Scoring… ${scoringSeconds}s (a few minutes on a long call)` : "Score the drill"}
          </button>
        </div>
      </form>
    </Card>
  );
}
