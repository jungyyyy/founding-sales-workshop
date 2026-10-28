"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/Shell";
import { createClient } from "@/lib/supabase/client";
import type { DisplayTurn } from "@/lib/buildDisplay";
import type { Founder } from "@/lib/types";
import { endSharedSession, startSharedSession } from "./actions";

type Turn = DisplayTurn;
type Art = { key: string; title: string; content: string; version: number; is_draft: boolean } | null;
type StreamEvent =
  | { type: "text"; text: string }
  | { type: "artifact"; artifact: NonNullable<Art>; done: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

// Broadcast payloads relayed by the founder whose browser is streaming the coach's reply.
type Relay =
  | { event: "user"; by: string; text: string }
  | { event: "delta"; text: string }
  | { event: "artifact"; artifact: NonNullable<Art>; done: boolean }
  | { event: "error"; message: string }
  | { event: "done" };

export function BuildClient(props: {
  module: number;
  moduleTitle: string;
  sessionId: number;
  sessionStatus: "open" | "done";
  initialMessages: Turn[];
  initialArtifact: Art;
  artifactKey: string;
  artifactTitle: string;
  shared: boolean;
  otherName: string;
  me: Founder;
  founders: Founder[];
  /** True when this screen is a shared session (both founders in one chat). */
  sharedSession: boolean;
  startedBy: string | null;
  canStartShared: boolean;
  sharedInvite: { id: number; startedBy: string } | null;
}) {
  const [messages, setMessages] = useState<Turn[]>(props.initialMessages);
  const [artifact, setArtifact] = useState<Art>(props.initialArtifact);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState<string | null>(null); // name of the founder whose turn is streaming
  const [done, setDone] = useState(props.sessionStatus === "done");
  const [otherPresent, setOtherPresent] = useState(false);
  const [present, setPresent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const channel = useRef<RealtimeChannel | null>(null);
  // Mirrors of state that the Realtime handlers (stale closures) need to read.
  const busyRef = useRef(false);
  const remoteBusyRef = useRef<string | null>(null);
  const lastRemoteActivity = useRef(0);

  function setRemote(name: string | null) {
    remoteBusyRef.current = name;
    lastRemoteActivity.current = Date.now();
    setRemoteBusy(name);
  }
  const supabase = useMemo(() => (props.sharedSession ? createClient() : null), [props.sharedSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Kick off the coach's first message on an empty session. In a shared session this happens
  // once the Realtime channel is subscribed (below), and only in the starter's browser.
  useEffect(() => {
    if (props.sharedSession) return;
    if (!started.current && props.initialMessages.length === 0 && !done) {
      started.current = true;
      void send(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watchdog: if the other founder's turn goes quiet (tab closed, laptop asleep), unlock after
  // two minutes without a relay and reload the session from the server.
  useEffect(() => {
    if (!props.sharedSession) return;
    const t = setInterval(() => {
      if (remoteBusyRef.current && Date.now() - lastRemoteActivity.current > 120_000) {
        setRemote(null);
        void resync();
      }
    }, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sharedSession]);

  // ---- shared session: presence + broadcast ----
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel(`build-${props.sessionId}`, {
      config: { presence: { key: props.me.slug }, broadcast: { self: false } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name: string }>();
      const names = Object.values(state).flatMap((metas) => metas.map((m) => m.name));
      setPresent(names);
      // The founder whose turn was streaming has left the room: their "done" will never come.
      if (remoteBusyRef.current && !names.includes(remoteBusyRef.current)) {
        setRemote(null);
        void resync();
      }
    });
    ch.on("broadcast", { event: "relay" }, ({ payload }: { payload: Relay }) => {
      lastRemoteActivity.current = Date.now();
      if (payload.event === "user") {
        setRemote(payload.by);
        setError(null);
        setMessages((m) => [...m, { role: "user", content: payload.text, by: payload.by }, { role: "assistant", content: "" }]);
      } else if (payload.event === "delta") {
        // Joined mid-turn (missed the "user" relay): lock the input anyway.
        if (!remoteBusyRef.current && !busyRef.current) setRemote(props.otherName);
        appendToLast(payload.text);
      } else if (payload.event === "artifact") {
        if (payload.artifact.key === props.artifactKey) setArtifact(payload.artifact);
        if (payload.done) setDone(true);
      } else if (payload.event === "error") {
        setError(payload.message);
      } else if (payload.event === "done") {
        setRemote(null);
        void resync();
      }
    });
    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await ch.track({ name: props.me.name });
      const starter = props.startedBy === props.me.name;
      if (starter && props.initialMessages.length === 0 && !started.current && !done) {
        started.current = true; // the first coach message, sent only once the relay can reach the other browser
        void send(null);
      } else {
        void resync(); // catch anything that happened between the server render and now
      }
    });
    channel.current = ch;
    return () => {
      channel.current = null;
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, props.sessionId]);

  function relay(payload: Relay) {
    void channel.current?.send({ type: "broadcast", event: "relay", payload });
  }

  function appendToLast(text: string) {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (!last || last.role !== "assistant") return [...copy, { role: "assistant", content: text }];
      copy[copy.length - 1] = { ...last, content: last.content + text };
      return copy;
    });
  }

  /** Reload the chat and artifact from the server (shared sessions only). */
  async function resync() {
    if (busyRef.current) return; // our own turn is streaming; the server copy is behind us
    try {
      const res = await fetch(`/api/build/session?id=${props.sessionId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: "open" | "done"; messages: Turn[]; artifact: Art };
      setMessages(data.messages);
      setArtifact(data.artifact);
      setDone(data.status === "done"); // a crossed turn can leave a "done" relay that never persisted
    } catch {
      /* keep what we have */
    }
  }

  async function send(text: string | null) {
    setBusy(true);
    busyRef.current = true;
    setError(null);
    setNotice(null);
    if (text) setMessages((m) => [...m, { role: "user", content: text, by: props.sharedSession ? props.me.name : undefined }]);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    if (props.sharedSession) relay({ event: "user", by: props.me.name, text: text ?? "" });

    // Coalesce streamed deltas before relaying them, to stay well under Realtime's rate limit.
    let pending = "";
    const flush = () => {
      if (!pending) return;
      relay({ event: "delta", text: pending });
      pending = "";
    };
    const timer = props.sharedSession ? setInterval(flush, 150) : null;

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: props.sessionId, module: props.module, message: text, otherPresent: props.sharedSession || otherPresent }),
      });
      if (res.status === 409) {
        // The other founder ended the session while we were typing.
        busyRef.current = false;
        setDone(true);
        void resync();
        throw new Error(await res.text());
      }
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "text") {
            appendToLast(ev.text);
            pending += ev.text;
          } else if (ev.type === "artifact") {
            if (ev.artifact.key === props.artifactKey) setArtifact(ev.artifact);
            else setNotice(`Saved ${ev.artifact.title} (v${ev.artifact.version}). It is on the Artifacts page.`);
            if (ev.done) setDone(true);
            if (props.sharedSession) {
              flush();
              relay({ event: "artifact", artifact: ev.artifact, done: ev.done });
            }
          } else if (ev.type === "error") {
            setError(ev.message);
            if (props.sharedSession) relay({ event: "error", message: ev.message });
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (props.sharedSession) relay({ event: "error", message });
    } finally {
      if (timer) clearInterval(timer);
      if (props.sharedSession) {
        flush();
        relay({ event: "done" });
      }
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy || remoteBusy || done) return;
    setInput("");
    void send(t);
  }

  const locked = busy || !!remoteBusy || done;
  const placeholder = done
    ? "This session is finished."
    : remoteBusy
      ? `${remoteBusy} is talking to the coach…`
      : busy
        ? "Coach is typing…"
        : "Your answer (Enter to send, Shift+Enter for a new line)";
  const streaming = busy || !!remoteBusy;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3">
      {/* shared-session banners */}
      {!props.sharedSession && props.sharedInvite && (
        <div className="flex items-center justify-between rounded-lg border border-accent bg-accent-soft px-4 py-2 text-sm">
          <span>
            <span className="font-medium">{props.sharedInvite.startedBy}</span> has a shared Build session open for this module.
          </span>
          <Link href={`/modules/${props.module}/build?session=${props.sharedInvite.id}`} className="rounded bg-accent px-3 py-1 text-xs font-medium text-white">
            Join
          </Link>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        {/* chat */}
        <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Link href={`/modules/${props.module}?tab=build`} className="text-muted hover:text-foreground">
                ← Module {props.module}
              </Link>
              <span className="text-muted">·</span>
              <span className="font-medium">Build with the coach</span>
              {props.sharedSession && <Badge tone="accent">shared session</Badge>}
            </div>
            {props.sharedSession ? (
              <div className="flex items-center gap-3">
                <ul className="flex items-center gap-2 text-xs" title="In the room">
                  {props.founders.map((f) => {
                    const here = present.includes(f.name);
                    return (
                      <li key={f.slug} className={`flex items-center gap-1 ${here ? "" : "text-muted"}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${here ? "bg-accent" : "bg-border"}`} />
                        {f.name}
                      </li>
                    );
                  })}
                </ul>
                {!done && (
                  <form action={endSharedSession.bind(null, props.sessionId)}>
                    <button className="text-xs text-muted hover:text-foreground">End session</button>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={otherPresent} onChange={(e) => setOtherPresent(e.target.checked)} />
                  {props.otherName} is here too
                </label>
                {props.canStartShared && !props.sharedInvite && (
                  <form action={startSharedSession.bind(null, props.module)}>
                    <button className="rounded border border-border px-2 py-1 text-xs hover:border-accent">Start shared session</button>
                  </form>
                )}
              </div>
            )}
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-accent text-white" : "bg-background border border-border"}`}>
                  {m.role === "user" && m.by && <div className="mb-0.5 text-[10px] uppercase tracking-wide text-white/70">{m.by}</div>}
                  {m.role === "assistant" ? <Markdown>{m.content || (streaming && i === messages.length - 1 ? "…" : "")}</Markdown> : m.content}
                </div>
              </div>
            ))}
            {error && <p className="rounded bg-warn-soft px-3 py-2 text-xs text-warn">{error}</p>}
            {notice && <p className="rounded bg-accent-soft px-3 py-2 text-xs text-accent">{notice}</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
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
              placeholder={placeholder}
              className="flex-1 resize-none rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              disabled={locked}
            />
            <button disabled={locked || !input.trim()} className="rounded bg-accent px-3 text-sm font-medium text-white disabled:opacity-50">
              Send
            </button>
          </form>
        </section>

        {/* artifact */}
        <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{artifact?.title ?? props.artifactTitle}</span>
              {artifact && (artifact.is_draft ? <Badge tone="warn">draft v{artifact.version}</Badge> : <Badge tone="accent">accepted v{artifact.version}</Badge>)}
              {props.shared ? <Badge tone="accent">shared</Badge> : <Badge>individual</Badge>}
            </div>
            <div className="flex items-center gap-3">
              {done && (
                <Link href={`/modules/${props.module}?tab=drill`} className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white">
                  Drill is ready →
                </Link>
              )}
              {artifact && (
                <Link href={`/artifacts/${artifact.key}`} className="text-xs text-muted hover:text-foreground">
                  Edit / comment
                </Link>
              )}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {artifact ? <Markdown>{artifact.content}</Markdown> : <p className="text-sm text-muted">The artifact appears here as the coach records your answers.</p>}
          </div>
          {props.sharedSession ? (
            <footer className="border-t border-border px-4 py-2 text-xs text-muted">Built together: every save lists both founders as authors and is accepted as written.</footer>
          ) : (
            props.shared &&
            artifact?.is_draft && (
              <footer className="border-t border-border px-4 py-2 text-xs text-muted">
                Shared artifact in DRAFT. {props.otherName} accepts it on the artifact page.
              </footer>
            )
          )}
        </section>
      </div>
    </div>
  );
}
