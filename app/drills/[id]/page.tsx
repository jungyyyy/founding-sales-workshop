import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Shell } from "@/components/Shell";
import { loadModule, loadPersona } from "@/lib/content";
import { founderBySlug, getDrill, requireFounder } from "@/lib/db";

export default async function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { founder } = await requireFounder();
  const drill = await getDrill(Number(id));
  if (!drill) notFound();
  const mod = loadModule(drill.module);
  const persona = loadPersona(drill.persona);
  const seller = founderBySlug(drill.founder_slug);
  const s = drill.score;
  const nextMod = loadModule(drill.module + 1);

  return (
    <Shell founder={founder}>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">
          Debrief · Module {drill.module} · {seller.name} vs {persona?.name ?? drill.persona}
          {drill.mode === "pair" && drill.buyer_slug ? <span className="text-base font-normal text-muted"> (played by {founderBySlug(drill.buyer_slug).name})</span> : null}
        </h1>
        <Link href={`/modules/${drill.module}?tab=debrief`} className="text-sm text-muted hover:text-foreground">
          ← Module {drill.module}
        </Link>
      </div>

      {drill.status !== "debriefed" || !s ? (
        <Card className="mt-4">
          <p className="text-sm">This drill is still live.</p>
          <Link
            href={drill.mode === "pair" && drill.briefs ? `/drills/${drill.id}/pair` : `/modules/${drill.module}/drill?id=${drill.id}`}
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            {drill.mode === "pair" && drill.briefs ? "Open your brief →" : "Continue the drill →"}
          </Link>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-semibold">
                  {s.total}
                  <span className="text-base text-muted">/{s.max}</span>
                </span>
                {s.below_threshold ? <Badge tone="warn">repeat recommended</Badge> : <Badge tone="accent">passed</Badge>}
                <Badge>{drill.mode}</Badge>
              </div>
              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-1 pr-2">#</th>
                    <th className="pb-1 pr-2">Criterion</th>
                    <th className="pb-1 pr-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border align-top">
                  {s.rows.map((r) => (
                    <tr key={r.n}>
                      <td className="py-2 pr-2 font-mono text-xs text-muted">{r.n}</td>
                      <td className="py-2 pr-2">
                        <div>{r.criterion}</div>
                        {r.quote && <blockquote className="mt-1 border-l-2 border-accent pl-2 text-xs italic text-muted">“{r.quote}”</blockquote>}
                        <div className="mt-1 text-xs text-muted">{r.why}</div>
                      </td>
                      <td className="py-2 pr-2 font-mono">{r.score}/2</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h2 className="text-sm font-semibold">Moments that mattered</h2>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {s.moments.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="flex flex-col gap-4">
            <Card className="border-accent">
              <h2 className="text-sm font-semibold">The one fix</h2>
              <p className="mt-1 text-sm">{s.fix}</p>
            </Card>
            {s.buyer_feedback && (
              <Card>
                <h2 className="text-sm font-semibold">Buyer realism ({founderBySlug(drill.buyer_slug).name})</h2>
                <p className="mt-1 text-sm">
                  {s.buyer_feedback.realism}/5 · {s.buyer_feedback.note}
                </p>
              </Card>
            )}
            <Card>
              <h2 className="text-sm font-semibold">CRM row written</h2>
              <dl className="mt-1 text-sm">
                <dt className="text-xs text-muted">Stage</dt>
                <dd>{s.crm_row.stage}</dd>
                <dt className="mt-1 text-xs text-muted">Next step</dt>
                <dd>{s.crm_row.next_step}</dd>
              </dl>
            </Card>
            {s.artifact_updates.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold">Suggested artifact updates</h2>
                <ul className="mt-1 text-sm">
                  {s.artifact_updates.map((u, i) => (
                    <li key={i} className="mt-1">
                      <Link href={`/artifacts/${u.key}`} className="font-mono text-xs text-accent hover:underline">
                        {u.key}
                      </Link>
                      : {u.note}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {s.unanswered_questions.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold">Questions you could not answer</h2>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {s.unanswered_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </Card>
            )}
            {s.below_threshold && mod?.rubric && (
              <Card className="border-warn">
                <p className="text-sm">{mod.rubric.below_threshold_note}</p>
                <p className="mt-2 text-xs text-muted">
                  {nextMod ? `Module ${nextMod.number} is already open for you; this is a recommendation, not a gate.` : "This is a recommendation, not a gate."}
                </p>
                <div className="mt-2 flex gap-4 text-sm">
                  <Link href={`/modules/${drill.module}?tab=drill`} className="text-accent hover:underline">
                    Drill again →
                  </Link>
                  {nextMod && (
                    <Link href={`/modules/${nextMod.number}`} className="text-accent hover:underline">
                      Go to Module {nextMod.number} →
                    </Link>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {drill.transcript_text && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold">Transcript (pasted)</h2>
          {drill.transcript_link && (
            <a href={drill.transcript_link} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-accent hover:underline">
              {drill.transcript_link}
            </a>
          )}
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{drill.transcript_text}</pre>
        </Card>
      )}

      {drill.transcript.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold">Transcript</h2>
          <div className="mt-2 space-y-2 text-sm">
            {drill.transcript.map((t, i) => (
              <div key={i}>
                <span className="font-medium">{t.role === "seller" ? seller.name : (persona?.name ?? "Buyer")}:</span> {t.content}
              </div>
            ))}
          </div>
        </Card>
      )}
    </Shell>
  );
}
