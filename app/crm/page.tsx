import Link from "next/link";
import { Card, Shell } from "@/components/Shell";
import { FounderFilter } from "@/components/FounderFilter";
import { loadAllPersonas } from "@/lib/content";
import { founderBySlug, listCrm, requireFounder } from "@/lib/db";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ founder?: string }> }) {
  const { founder: filter } = await searchParams;
  const { founder } = await requireFounder();
  const rows = (await listCrm()).filter((r) => !filter || r.founder_slug === filter);
  const personas = Object.fromEntries(loadAllPersonas().map((p) => [p.key, p.name]));
  return (
    <Shell founder={founder} wide>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">CRM log</h1>
        <FounderFilter base="/crm" current={filter} />
      </div>
      <p className="mt-1 text-sm text-muted">Every drill, no exceptions. Written by the grader at debrief. If it is not recorded, it did not happen.</p>
      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-border/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">Persona</th>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Stage reached</th>
              <th className="px-3 py-2">What they said that mattered</th>
              <th className="px-3 py-2">Next step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  Empty. Run a drill.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.date}</td>
                <td className="px-3 py-2">{founderBySlug(r.founder_slug).name}</td>
                <td className="px-3 py-2">{personas[r.persona] ?? r.persona}</td>
                <td className="px-3 py-2">
                  {r.drill_id ? (
                    <Link href={`/drills/${r.drill_id}`} className="text-accent hover:underline">
                      M{r.module}
                    </Link>
                  ) : (
                    `M${r.module}`
                  )}
                </td>
                <td className="px-3 py-2">{r.stage}</td>
                <td className="px-3 py-2 text-muted">{r.key_quotes}</td>
                <td className="px-3 py-2">{r.next_step}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
