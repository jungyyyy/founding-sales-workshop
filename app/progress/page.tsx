import { Badge, Card, Shell } from "@/components/Shell";
import { FounderFilter } from "@/components/FounderFilter";
import { loadAllModules } from "@/lib/content";
import { FOUNDERS, getStandingFixes, listCurrentArtifacts, listProgress, requireFounder } from "@/lib/db";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ founder?: string }> }) {
  const { founder: filter } = await searchParams;
  const shown = FOUNDERS.filter((f) => !filter || f.slug === filter);
  const { founder } = await requireFounder();
  const [modules, progress, artifacts, fixesByFounder] = await Promise.all([
    Promise.resolve(loadAllModules()),
    listProgress(),
    listCurrentArtifacts(),
    Promise.all(FOUNDERS.map((f) => getStandingFixes(f.slug))),
  ]);
  const cell = (n: number, slug: string) => {
    const p = progress.find((r) => r.module === n && r.founder_slug === slug);
    if (!p || p.status === "locked") return <Badge>locked</Badge>;
    return (
      <div className="flex flex-col gap-0.5">
        <span>
          <Badge tone={p.status === "drilled" || p.status === "done" ? "accent" : "warn"}>{p.status}</Badge>
          {p.best_score != null && (
            <span className="ml-2 font-mono text-xs">
              {p.best_score}/{p.max_score}
            </span>
          )}
        </span>
        {p.carry_fix && <span className="text-xs text-muted">Fix: {p.carry_fix}</span>}
      </div>
    );
  };
  const artifactFor = (n: number) => {
    const m = modules.find((x) => x.number === n);
    if (!m?.build) return <span className="text-xs text-muted">—</span>;
    if (!m.build.shared) {
      const have = FOUNDERS.filter((f) => artifacts.some((a) => a.key === `${m.build!.artifact_key}-${f.slug}`));
      return <span className="text-xs text-muted">{have.length ? `individual · ${have.map((f) => f.name).join(", ")}` : "not built yet"}</span>;
    }
    const a = artifacts.find((x) => x.key === m.build!.artifact_key);
    if (!a) return <span className="text-xs text-muted">not built yet</span>;
    return (
      <span className="text-xs">
        {a.title} v{a.version} {a.is_draft ? <Badge tone="warn">draft</Badge> : <Badge tone="accent">accepted</Badge>}
      </span>
    );
  };

  return (
    <Shell founder={founder}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Progress</h1>
        <FounderFilter base="/progress" current={filter} />
      </div>
      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-border/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Shared artifact</th>
              {shown.map((f) => (
                <th key={f.slug} className="px-3 py-2">
                  {f.name} score / fix
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {modules.map((m) => (
              <tr key={m.number}>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="mr-2 font-mono text-xs text-muted">{String(m.number).padStart(2, "0")}</span>
                  {m.title}
                </td>
                <td className="px-3 py-2">{artifactFor(m.number)}</td>
                {shown.map((f) => (
                  <td key={f.slug} className="px-3 py-2">
                    {cell(m.number, f.slug)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-4">
        <h2 className="text-sm font-semibold">Standing fixes (from Module 1 self-assessment)</h2>
        <div className="mt-2 grid gap-4 text-sm md:grid-cols-2">
          {FOUNDERS.map((f, i) => [f.name, fixesByFounder[i]] as const).map(([name, fixes]) => (
            <div key={name as string}>
              <div className="text-xs uppercase tracking-wide text-muted">{name as string}</div>
              {(fixes as string[]).length ? (
                <ol className="mt-1 list-decimal pl-5">
                  {(fixes as string[]).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1 text-muted">Not set yet.</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </Shell>
  );
}
