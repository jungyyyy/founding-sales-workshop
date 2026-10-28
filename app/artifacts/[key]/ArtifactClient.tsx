"use client";
import { useState, useTransition } from "react";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/Shell";
import { isIndividualKey } from "@/lib/founders";
import type { Artifact, Founder } from "@/lib/types";
import { accept, comment, saveEdit, toggleNote } from "../actions";

type VersionRow = { id: number; version: number; created_by: string; created_at: string; is_draft: boolean };
type NoteRow = { id: number; artifact_id: number; author: string; body: string; resolved: boolean; created_at: string };

export function ArtifactClient(props: {
  current: Artifact;
  versions: VersionRow[];
  notes: NoteRow[];
  viewer: Founder;
  canAccept: boolean;
  createdByName: string;
  acceptedByName: string | null;
}) {
  const { current } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current.content);
  const [title, setTitle] = useState(current.title);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const individual = isIndividualKey(current.key);

  return (
    <div className="grid gap-4 md:grid-cols-[3fr_1fr]">
      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            {editing ? (
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm" />
            ) : (
              <h1 className="font-semibold">{current.title}</h1>
            )}
            <Badge>v{current.version}</Badge>
            {individual ? <Badge>individual</Badge> : current.is_draft ? <Badge tone="warn">DRAFT — needs {props.viewer.name === props.createdByName ? "the other founder's" : "your"} review</Badge> : <Badge tone="accent">accepted by {props.acceptedByName}</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {props.canAccept && !editing && (
              <button
                disabled={pending}
                onClick={() => start(() => accept(current.id, current.key))}
                className="rounded bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Accept v{current.version}
              </button>
            )}
            {editing ? (
              <>
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await saveEdit(current.key, draft, title);
                      setEditing(false);
                    })
                  }
                  className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
                >
                  {pending ? "Saving…" : `Save as v${current.version + 1}`}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(current.content);
                    setTitle(current.title);
                  }}
                  className="text-xs text-muted"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="rounded border border-border px-3 py-1 text-xs">
                Edit
              </button>
            )}
          </div>
        </header>
        <div className="px-5 py-3">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-[70vh] w-full resize-y rounded border border-border bg-background p-3 font-mono text-xs outline-none focus:border-accent"
            />
          ) : (
            <Markdown>{current.content}</Markdown>
          )}
        </div>
        {!individual && editing && (
          <footer className="border-t border-border px-4 py-2 text-xs text-muted">Saving a shared artifact creates a new DRAFT version that the other founder must accept.</footer>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Comments</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {props.notes.length === 0 && <li className="text-xs text-muted">None yet.</li>}
            {props.notes.map((n) => (
              <li key={n.id} className={`rounded border border-border p-2 ${n.resolved ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {n.author} · v{props.versions.find((v) => v.id === n.artifact_id)?.version ?? "?"}
                  </span>
                  <button onClick={() => start(() => toggleNote(n.id, !n.resolved, current.key))} className="hover:text-foreground">
                    {n.resolved ? "reopen" : "resolve"}
                  </button>
                </div>
                <p className="mt-1">{n.body}</p>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const b = note;
              setNote("");
              start(() => comment(current.id, current.key, b));
            }}
            className="mt-3 flex flex-col gap-2"
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={`Comment as ${props.viewer.name} on v${current.version}`}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button disabled={pending || !note.trim()} className="self-end rounded border border-border px-3 py-1 text-xs disabled:opacity-50">
              Add comment
            </button>
          </form>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Versions</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {props.versions.map((v) => (
              <li key={v.id} className="flex justify-between">
                <span>
                  v{v.version} · {v.created_by}
                </span>
                <span>
                  {new Date(v.created_at).toLocaleDateString()} {v.is_draft ? "· draft" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
