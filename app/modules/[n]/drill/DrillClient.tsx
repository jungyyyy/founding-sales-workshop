"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/Shell";
import type { Drill, TranscriptTurn } from "@/lib/types";
import { awaitLongJob } from "@/lib/ndjson";

export function DrillClient(props: {
  drill: Drill;
  module: number;
  moduleTitle: string;
  scenario: string;
  channel: string;
  timeLimit: string;
  rounds: number;
  persona: { name: string; role: string; markdown: string | null };
  sellerName: string;
  buyerName: string;
  viewerIsSeller: boolean;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<TranscriptTurn[]>(props.drill.transcript);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [debriefing, setDebriefing] = useState(false);
  const [scoringSeconds, setScoringSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pairRole, setPairRole] = useState<"seller" | "buyer">("seller");
  const [showPersona, setShowPersona] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isPair = props.drill.mode === "pair";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function sendSolo(text: string) {
    setBusy(true);
    setError(null);
    const sellerTurn: TranscriptTurn = { role: "seller", content: text, ts: new Date().toISOString() };
    setTurns((t) => [...t, sellerTurn, { role: "buyer", content: "", ts: new Date().toISOString() }]);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drillId: props.drill.id, message: text }),
      });
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
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: "text"; text: string } | { type: "error"; message: string } | { type: "done" };
          if (ev.type === "text") {
            setTurns((t) => {
              const copy = [...t];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + ev.text };
              return copy;
            });
          } else if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendPair(text: string) {
    setBusy(true);
    setError(null);
    const turn: TranscriptTurn = { role: pairRole, content: text, ts: new Date().toISOString() };
    const next = [...turns, turn];
    setTurns(next);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drillId: props.drill.id, pairTurn: turn }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPairRole((r) => (r === "seller" ? "buyer" : "seller"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    if (isPair) void sendPair(t);
    else void sendSolo(t);
  }

  async function debrief() {
    if (!confirm("End the drill and score it? The buyer leaves the conversation.")) return;
    setDebriefing(true);
    setScoringSeconds(0);
    setError(null);
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drillId: props.drill.id }),
      });
      // A plain JSON reply means the drill was already scored; otherwise it is a heartbeat stream.
      if (res.headers.get("content-type")?.includes("application/json")) {
        if (!res.ok) throw new Error(await res.text());
      } else {
        await awaitLongJob(res, setScoringSeconds);
      }
      router.push(`/drills/${props.drill.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDebriefing(false);
    }
  }

  const sellerTurns = turns.filter((t) => t.role === "seller").length;

  return (
    <div className="grid h-[calc(100vh-7.5rem)] gap-4 md:grid-cols-[2fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Link href={`/modules/${props.module}?tab=drill`} className="text-muted hover:text-foreground">
              ← Module {props.module}
            </Link>
            <span className="text-muted">·</span>
            <span className="font-medium">Drill with {props.persona.name}</span>
            <Badge tone={isPair ? "warn" : "accent"}>{props.drill.mode}</Badge>
          </div>
          <button
            onClick={debrief}
            disabled={debriefing || sellerTurns === 0}
            className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
          >
            {debriefing ? `Scoring… ${scoringSeconds}s` : "Debrief"}
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === "seller" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${t.role === "seller" ? "bg-accent text-white" : "border border-border bg-background"}`}>
                <div className={`mb-0.5 text-[10px] uppercase tracking-wide ${t.role === "seller" ? "text-white/70" : "text-muted"}`}>
                  {t.role === "seller" ? props.sellerName : props.buyerName}
                </div>
                {t.content || (busy && i === turns.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
          {error && <p className="rounded bg-warn-soft px-3 py-2 text-xs text-warn">{error}</p>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border p-3">
          {isPair && (
            <select
              value={pairRole}
              onChange={(e) => setPairRole(e.target.value as "seller" | "buyer")}
              className="rounded border border-border bg-background px-2 py-2 text-xs"
            >
              <option value="seller">{props.sellerName} (seller)</option>
              <option value="buyer">{props.buyerName} as {props.persona.name.split(" ")[0]}</option>
            </select>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={2}
            disabled={busy || debriefing}
            placeholder={isPair ? `Type as ${pairRole}…` : "Speak as yourself. Enter to send."}
            className="flex-1 resize-none rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button disabled={busy || debriefing || !input.trim()} className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Send
          </button>
        </form>
      </section>

      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">Scenario</h2>
          <p className="mt-1 text-muted">{props.scenario}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
            <dt>Channel</dt>
            <dd>{props.channel}</dd>
            <dt>Time</dt>
            <dd>{props.timeLimit}</dd>
            <dt>Your turns</dt>
            <dd>{sellerTurns}</dd>
          </dl>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">{props.persona.name}</h2>
          <p className="text-muted">{props.persona.role}</p>
          {isPair && props.persona.markdown ? (
            <>
              <button onClick={() => setShowPersona((s) => !s)} className="mt-2 text-xs text-accent hover:underline">
                {showPersona ? "Hide" : "Show"} persona file (for the buyer)
              </button>
              {showPersona && (
                <div className="mt-2 text-xs">
                  <Markdown>{props.persona.markdown}</Markdown>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">No coaching mid-drill. Press Debrief when you have asked for a next step, or when the buyer leaves.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
