import Link from "next/link";
import { Badge, Card, Shell } from "@/components/Shell";
import { loadAllModules } from "@/lib/content";
import {
  FOUNDERS,
  founderBySlug,
  getStandingFixes,
  listCrm,
  listDrills,
  listOpenPairDrills,
  listOpenSharedSessions,
  listProgress,
  requireFounder,
  seedCompanyIfMissing,
} from "@/lib/db";

export default async function Dashboard() {
  const { founder } = await requireFounder();
  await seedCompanyIfMissing(founder.slug);
  const [modules, progress, drills, crm, fixes, sharedSessions, pairDrills] = await Promise.all([
    Promise.resolve(loadAllModules()),
    listProgress(),
    listDrills(),
    listCrm(),
    getStandingFixes(founder.slug),
    listOpenSharedSessions(),
    listOpenPairDrills(),
  ]);
  const titleOf = (n: number) => modules.find((m) => m.number === n)?.title ?? `Module ${n}`;

  const statusOf = (n: number, slug: string) => progress.find((p) => p.module === n && p.founder_slug === slug)?.status ?? (n === 1 ? "open" : "locked");
  const recent = drills.slice(0, 5);

  return (
    <Shell founder={founder}>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <section>
          <h1 className="text-xl font-semibold">Modules</h1>
          <p className="mt-1 text-sm text-muted">Sequential. Any debriefed drill unlocks the next module for you, whatever the score.</p>
          <div className="mt-4 flex flex-col gap-2">
            {modules.map((m) => {
              const mine = statusOf(m.number, founder.slug);
              const locked = mine === "locked";
              const row = (
                <Card className={`flex items-center justify-between ${locked ? "opacity-60" : "hover:border-accent"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted">{String(m.number).padStart(2, "0")}</span>
                      <span className="font-medium">{m.title}</span>
                      {m.status === "stub" && <Badge>stub</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      Chapter {m.chapter} · pp. {m.pages}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {FOUNDERS.map((f) => {
                      const s = statusOf(m.number, f.slug);
                      return (
                        <span key={f.slug} className="flex flex-col items-end">
                          <span className="text-muted">{f.name}</span>
                          <Badge tone={s === "done" || s === "drilled" ? "accent" : s === "locked" ? "neutral" : "warn"}>{s}</Badge>
                        </span>
                      );
                    })}
                  </div>
                </Card>
              );
              return locked ? (
                <div key={m.number}>{row}</div>
              ) : (
                <Link key={m.number} href={`/modules/${m.number}`}>
                  {row}
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {(sharedSessions.length > 0 || pairDrills.length > 0) && (
            <Card className="border-accent">
              <h2 className="text-sm font-semibold">Together</h2>
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {sharedSessions.map((s) => (
                  <li key={`s${s.id}`} className="flex items-center justify-between gap-2">
                    <span>
                      Shared Build · M{s.module} {titleOf(s.module)}
                      <span className="block text-xs text-muted">started by {founderBySlug(s.founder_slug).name}</span>
                    </span>
                    <Link href={`/modules/${s.module}/build?session=${s.id}`} className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white">
                      {s.founder_slug === founder.slug ? "Open" : "Join"}
                    </Link>
                  </li>
                ))}
                {pairDrills.map((d) => {
                  const iSell = d.seller_slug === founder.slug;
                  return (
                    <li key={`d${d.id}`} className="flex items-center justify-between gap-2">
                      <span>
                        Pair drill · M{d.module} · {d.persona.split("-")[0]}
                        <span className="block text-xs text-muted">{iSell ? "you sell" : `you play the buyer, ${founderBySlug(d.seller_slug).name} sells`}</span>
                      </span>
                      <Link href={`/drills/${d.id}/pair`} className="rounded border border-accent px-2.5 py-1 text-xs font-medium text-accent">
                        My brief
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <Card>
            <h2 className="text-sm font-semibold">Your standing fixes</h2>
            {fixes.length ? (
              <ol className="mt-2 list-decimal pl-5 text-sm">
                {fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">Set in the Module 1 Build (your two lowest mindsets).</p>
            )}
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Recent drills</h2>
            {recent.length ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {recent.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <Link href={`/drills/${d.id}`} className="hover:underline">
                      M{d.module} · {d.persona.split("-")[0]} · {FOUNDERS.find((f) => f.slug === d.founder_slug)?.name}
                    </Link>
                    <span className="text-xs text-muted">
                      {d.status === "debriefed" && d.score ? `${d.score.total}/${d.score.max}` : "live"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No drills yet.</p>
            )}
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">CRM</h2>
            <p className="mt-2 text-sm text-muted">{crm.length} logged conversation{crm.length === 1 ? "" : "s"}.</p>
            <Link href="/crm" className="mt-1 inline-block text-sm text-accent hover:underline">
              Open the log →
            </Link>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}
