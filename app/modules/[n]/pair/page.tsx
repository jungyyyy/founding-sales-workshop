import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Shell } from "@/components/Shell";
import { loadAllPersonas, loadModule } from "@/lib/content";
import { isModuleOpen, otherFounder, requireFounder } from "@/lib/db";
import { startPairDrill } from "./actions";

export const maxDuration = 300; // the server action calls Claude to write the briefs

export default async function PairSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { n } = await params;
  const { error } = await searchParams;
  const num = Number(n);
  const mod = loadModule(num);
  if (!mod?.drill || !mod.rubric) notFound();
  const { founder } = await requireFounder();
  if (!(await isModuleOpen(num, founder.slug))) redirect("/");
  const other = otherFounder(founder.slug);
  const personas = loadAllPersonas();

  return (
    <Shell founder={founder}>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Pair drill · Module {num}</h1>
        <Link href={`/modules/${num}?tab=drill`} className="text-sm text-muted hover:text-foreground">
          ← Module {num}
        </Link>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
        <Card>
          <form action={startPairDrill.bind(null, num)} className="flex flex-col gap-5">
            <fieldset>
              <legend className="text-sm font-semibold">Who is the buyer?</legend>
              <div className="mt-2 flex flex-col gap-2">
                {personas.map((p) => (
                  <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded border border-border p-3 text-sm has-[:checked]:border-accent">
                    <input type="radio" name="persona" value={p.key} defaultChecked={p.key === mod.drill!.persona} className="mt-1" />
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{p.role}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">Who sells?</legend>
              <div className="mt-2 flex gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 has-[:checked]:border-accent">
                  <input type="radio" name="seller" value={founder.slug} defaultChecked /> {founder.name} sells, {other.name} plays the buyer
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 has-[:checked]:border-accent">
                  <input type="radio" name="seller" value={other.slug} /> {other.name} sells, {founder.name} plays the buyer
                </label>
              </div>
            </fieldset>
            {error && (
              <p className="rounded bg-warn-soft px-3 py-2 text-xs text-warn">
                {error === "briefs" ? "The briefs could not be generated. Try again in a moment." : error === "seller" ? `${other.name} has not reached this module yet, so they cannot sell it. Pick the other option.` : "That persona does not exist."}
              </p>
            )}
            <div>
              <button className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">Generate briefs</button>
              <p className="mt-2 text-xs text-muted">Takes about half a minute. Each of you then opens your own brief from the dashboard. Nobody sees the other&apos;s brief.</p>
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Scenario</h2>
          <p className="mt-2 text-sm">{mod.drill.scenario}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
            <dt>Channel</dt>
            <dd>{mod.drill.channel}</dd>
            <dt>Time</dt>
            <dd>{mod.drill.time_limit}</dd>
          </dl>
          <h3 className="mt-4 text-sm font-semibold">How a pair drill works</h3>
          <ol className="mt-1 list-decimal pl-5 text-sm text-muted">
            <li>The seller gets public context only. The buyer gets the whole persona plus a hidden agenda.</li>
            <li>Run the call for real: in a room or on a video call, recorded if you can.</li>
            <li>Paste the transcript on the Debrief screen. The seller is scored on the module rubric; the buyer gets a note on realism.</li>
          </ol>
        </Card>
      </div>
    </Shell>
  );
}
