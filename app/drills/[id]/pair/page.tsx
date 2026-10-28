import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Card, Shell } from "@/components/Shell";
import { Markdown } from "@/components/Markdown";
import { loadModule, loadPersona } from "@/lib/content";
import { founderBySlug, getDrill, requireFounder } from "@/lib/db";

/** A founder's own brief for a pair drill. The other founder's brief is never sent to this page. */
export default async function PairBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { founder } = await requireFounder();
  const drill = await getDrill(Number(id));
  if (!drill || drill.mode !== "pair" || !drill.briefs) notFound();
  if (!drill.participants?.includes(founder.slug)) notFound();
  if (drill.status === "debriefed") redirect(`/drills/${drill.id}`);
  const mod = loadModule(drill.module);
  const persona = loadPersona(drill.persona);
  const role: "seller" | "buyer" = drill.seller_slug === founder.slug ? "seller" : "buyer";
  const brief = role === "seller" ? drill.briefs.seller : drill.briefs.buyer;
  const seller = founderBySlug(drill.seller_slug);
  const buyer = founderBySlug(drill.buyer_slug);

  return (
    <Shell founder={founder}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Pair drill · Module {drill.module} · {persona?.name ?? drill.persona}
        </h1>
        <Link href={`/modules/${drill.module}?tab=drill`} className="text-sm text-muted hover:text-foreground">
          ← Module {drill.module}
        </Link>
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm text-muted">
        <span>
          {seller.name} sells · {buyer.name} plays {persona?.name.split(" ")[0] ?? "the buyer"}
        </span>
        <Badge tone={role === "seller" ? "accent" : "warn"}>you: {role}</Badge>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
        <Card className={role === "buyer" ? "border-warn" : "border-accent"}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your {role} brief</h2>
            <span className="text-xs text-muted">Private. Do not share your screen.</span>
          </div>
          <div className="mt-3 text-sm">
            <Markdown>{brief}</Markdown>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-sm font-semibold">Scenario</h2>
            <p className="mt-1 text-sm text-muted">{mod?.drill?.scenario}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
              <dt>Channel</dt>
              <dd>{mod?.drill?.channel}</dd>
              <dt>Time</dt>
              <dd>{mod?.drill?.time_limit}</dd>
            </dl>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">After the call</h2>
            <p className="mt-1 text-sm text-muted">Paste the transcript (or your notes, plus a Wispr share link if you have one). The seller is scored on the module rubric; the buyer gets a note on realism.</p>
            <Link href={`/drills/${drill.id}/pair/debrief`} className="mt-3 inline-block rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background">
              Debrief →
            </Link>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
