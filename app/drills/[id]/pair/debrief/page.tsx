import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Shell } from "@/components/Shell";
import { loadModule, loadPersona } from "@/lib/content";
import { founderBySlug, getDrill, requireFounder } from "@/lib/db";
import { DebriefForm } from "./DebriefForm";

export default async function PairDebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { founder } = await requireFounder();
  const drill = await getDrill(Number(id));
  if (!drill || drill.mode !== "pair" || !drill.briefs) notFound();
  if (!drill.participants?.includes(founder.slug)) notFound();
  if (drill.status === "debriefed") redirect(`/drills/${drill.id}`);
  const mod = loadModule(drill.module);
  const persona = loadPersona(drill.persona);
  const seller = founderBySlug(drill.seller_slug);
  const buyer = founderBySlug(drill.buyer_slug);

  return (
    <Shell founder={founder}>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Debrief the pair drill · Module {drill.module}</h1>
        <Link href={`/drills/${drill.id}/pair`} className="text-sm text-muted hover:text-foreground">
          ← My brief
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        {seller.name} sold to {buyer.name} as {persona?.name ?? drill.persona}. The seller is scored on the Module {drill.module} rubric; the buyer gets a note on how true to the persona they were.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
        <DebriefForm drillId={drill.id} initialTranscript={drill.transcript_text ?? ""} initialLink={drill.transcript_link ?? ""} sellerName={seller.name} buyerName={buyer.name} />
        <Card>
          <h2 className="text-sm font-semibold">Rubric (max {mod?.rubric?.max}, repeat recommended below {mod?.rubric?.threshold})</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm">
            {mod?.rubric?.rows.map((r) => (
              <li key={r.n}>{r.criterion}</li>
            ))}
          </ol>
          <h3 className="mt-4 text-sm font-semibold">Transcript tips</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">
            <li>Any format works: a recorder export, chat log, or your notes. Label speakers if you can.</li>
            <li>A Wispr Flow share link is stored with the drill for reference. Paste the transcript text as well: the grader only reads the text.</li>
            <li>Once scored, the drill is closed and the CRM row is written for the seller.</li>
          </ul>
        </Card>
      </div>
    </Shell>
  );
}
