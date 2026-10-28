import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Card, Shell } from "@/components/Shell";
import { Markdown } from "@/components/Markdown";
import { loadModule, loadPersona } from "@/lib/content";
import { FOUNDERS, bumpProgress, getCurrentArtifact, isModuleOpen, listDrills, requireFounder } from "@/lib/db";

const TABS = ["brief", "build", "drill", "debrief"] as const;
type Tab = (typeof TABS)[number];

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { n } = await params;
  const { tab: rawTab } = await searchParams;
  const num = Number(n);
  const mod = loadModule(num);
  if (!mod) notFound();
  const { founder } = await requireFounder();
  if (!(await isModuleOpen(num, founder.slug))) redirect("/");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "brief";

  if (mod.status === "ready") await bumpProgress(num, founder.slug, "briefed");
  const pairReady = !!(mod.drill && mod.rubric); // pair drills need a scenario and a rubric, not a written brief

  const artifactKey = mod.build ? (mod.build.shared ? mod.build.artifact_key : `${mod.build.artifact_key}-${founder.slug}`) : null;
  const [artifact, drills] = await Promise.all([artifactKey ? getCurrentArtifact(artifactKey) : null, listDrills({ module: num })]);
  const persona = mod.drill ? loadPersona(mod.drill.persona) : null;

  return (
    <Shell founder={founder}>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">
          <span className="mr-2 font-mono text-sm text-muted">{String(num).padStart(2, "0")}</span>
          {mod.title}
        </h1>
        <span className="text-xs text-muted">
          Chapter {mod.chapter} · pp. {mod.pages}
        </span>
      </div>

      <nav className="mt-4 flex gap-1 border-b border-border text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/modules/${num}?tab=${t}`}
            className={`-mb-px border-b-2 px-3 py-2 capitalize ${tab === t ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {mod.status === "stub" && (
          <Card>
            <p className="text-sm text-muted">{mod.brief_markdown}</p>
            {pairReady && mod.drill && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm">The pair drill for this module is ready: {mod.drill.scenario}</p>
                <Link href={`/modules/${num}/pair`} className="mt-3 inline-block rounded border border-accent px-3 py-1.5 text-sm font-medium text-accent">
                  Pair drill →
                </Link>
              </div>
            )}
          </Card>
        )}

        {mod.status === "ready" && tab === "brief" && (
          <Card>
            <Markdown>{mod.brief_markdown}</Markdown>
            <div className="mt-6 border-t border-border pt-4">
              <Link href={`/modules/${num}?tab=build`} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
                Go to Build →
              </Link>
            </div>
          </Card>
        )}

        {mod.status === "ready" && tab === "build" && mod.build && (
          <Card>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{mod.build.artifact_title}</h2>
              {mod.build.shared ? <Badge tone="accent">shared</Badge> : <Badge>individual</Badge>}
              {artifact && artifact.is_draft && <Badge tone="warn">draft v{artifact.version}</Badge>}
              {artifact && !artifact.is_draft && <Badge tone="accent">accepted v{artifact.version}</Badge>}
            </div>
            <div className="mt-3 text-sm">
              <Markdown>{mod.build.spec_markdown}</Markdown>
            </div>
            <div className="mt-5 flex gap-3">
              <Link href={`/modules/${num}/build`} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
                {artifact ? "Continue building" : "Start building with the coach"}
              </Link>
              {artifact && (
                <Link href={`/artifacts/${artifact.key}`} className="rounded border border-border px-3 py-1.5 text-sm">
                  Open artifact
                </Link>
              )}
            </div>
          </Card>
        )}

        {mod.status === "ready" && tab === "drill" && mod.drill && persona && (
          <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
            <Card>
              <h2 className="font-semibold">Scenario</h2>
              <p className="mt-2 text-sm">{mod.drill.scenario}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                <dt>Channel</dt>
                <dd>{mod.drill.channel}</dd>
                <dt>Time</dt>
                <dd>{mod.drill.time_limit}</dd>
                <dt>Rounds</dt>
                <dd>{mod.drill.rounds}</dd>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/modules/${num}/drill?mode=solo`} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
                  Start solo drill (AI buyer)
                </Link>
                <Link href={`/modules/${num}/pair`} className="rounded border border-border px-3 py-1.5 text-sm">
                  Pair drill (one sells, the other plays the buyer)
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">Drills are individual and scored on the module rubric. The CRM log is written automatically at debrief. A pair drill gives each of you a private brief; you run the call yourselves and paste the transcript to debrief.</p>
            </Card>
            <Card>
              <h2 className="font-semibold">{persona.name}</h2>
              <p className="text-sm text-muted">{persona.role}</p>
              <p className="mt-2 text-xs text-muted">The persona file is hidden during solo drills. In a pair drill the buyer reads it.</p>
            </Card>
          </div>
        )}

        {mod.status === "ready" && tab === "debrief" && (
          <Card>
            <h2 className="font-semibold">Drills in this module</h2>
            {drills.length === 0 && <p className="mt-2 text-sm text-muted">No drills yet.</p>}
            <ul className="mt-3 divide-y divide-border text-sm">
              {drills.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link href={d.mode === "pair" && d.status === "live" && d.briefs ? `/drills/${d.id}/pair` : `/drills/${d.id}`} className="font-medium hover:underline">
                      {FOUNDERS.find((f) => f.slug === d.founder_slug)?.name}
                      {d.mode === "pair" && d.buyer_slug ? ` vs ${FOUNDERS.find((f) => f.slug === d.buyer_slug)?.name}` : ""} · {d.mode} ·{" "}
                      {new Date(d.started_at).toLocaleString()}
                    </Link>
                    {d.status === "debriefed" && d.score && <div className="text-xs text-muted">Fix: {d.score.fix}</div>}
                  </div>
                  <span className="font-mono text-sm">{d.status === "debriefed" && d.score ? `${d.score.total}/${d.score.max}` : <Badge tone="warn">live</Badge>}</span>
                </li>
              ))}
            </ul>
            {mod.rubric && (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Rubric (max {mod.rubric.max}, repeat recommended below {mod.rubric.threshold})</h3>
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {mod.rubric.rows.map((r) => (
                    <li key={r.n}>{r.criterion}</li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
