import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { loadModule, loadPersona } from "@/lib/content";
import { createDrill, getDrill, isModuleOpen, otherFounder, requireFounder } from "@/lib/db";
import { DrillClient } from "./DrillClient";

export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ mode?: string; id?: string }>;
}) {
  const { n } = await params;
  const { mode: rawMode, id } = await searchParams;
  const num = Number(n);
  const mod = loadModule(num);
  if (!mod || !mod.drill) notFound();
  const { founder } = await requireFounder();
  if (!(await isModuleOpen(num, founder.slug))) redirect("/");
  const persona = loadPersona(mod.drill.persona);
  if (!persona) notFound();

  const mode = rawMode === "pair" ? "pair" : "solo";
  let drill = id ? await getDrill(Number(id)) : null;
  if (!drill) {
    drill = await createDrill({
      module: num,
      persona: mod.drill.persona,
      founder: founder.slug,
      mode,
      buyer: mode === "pair" ? otherFounder(founder.slug).slug : null,
      opening: mod.drill.buyer_opening,
    });
    redirect(`/modules/${num}/drill?id=${drill.id}`);
  }
  if (drill.status === "debriefed") redirect(`/drills/${drill.id}`);
  if (drill.mode === "pair" && drill.briefs) redirect(`/drills/${drill.id}/pair`);

  return (
    <Shell founder={founder} wide>
      <DrillClient
        drill={drill}
        module={num}
        moduleTitle={mod.title}
        scenario={mod.drill.scenario}
        channel={mod.drill.channel}
        timeLimit={mod.drill.time_limit}
        rounds={mod.drill.rounds}
        persona={{ name: persona.name, role: persona.role, markdown: drill.mode === "pair" ? persona.markdown : null }}
        sellerName={founder.name}
        buyerName={drill.mode === "pair" ? otherFounder(founder.slug).name : persona.name}
        viewerIsSeller={drill.founder_slug === founder.slug}
      />
    </Shell>
  );
}
