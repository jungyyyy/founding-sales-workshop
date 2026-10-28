import { loadModule, loadPersona, loadRules, sharedArtifactKeys } from "@/lib/content";
import {
  addCrmRow,
  bumpProgress,
  founderBySlug,
  getCurrentArtifact,
  getDrill,
  listDrills,
  requireFounder,
  saveDrillScore,
  savePairTranscript,
  unlockNext,
} from "@/lib/db";
import { gradeTranscript, longJobResponse } from "@/lib/grader";
import { graderSystem } from "@/lib/prompts";
import type { DrillScore } from "@/lib/types";

export const runtime = "nodejs";
// Grading runs at high effort and can take a few minutes on a long transcript. 300 s is the
// ceiling on Vercel Hobby with fluid compute (default for new projects); Pro allows 800.
export const maxDuration = 300;

/** Grade a pair drill from a pasted transcript. Either participant may submit it. */
export async function POST(req: Request) {
  const { founder: viewer } = await requireFounder();
  const body = (await req.json()) as { drillId: number; transcript: string; link: string | null };
  const drill = await getDrill(body.drillId);
  if (!drill || drill.mode !== "pair" || !drill.briefs) return new Response("not a pair drill", { status: 404 });
  if (!drill.participants?.includes(viewer.slug)) return new Response("not your drill", { status: 403 });
  if (drill.status === "debriefed") return Response.json({ ok: true, already: true });
  const transcript = (body.transcript ?? "").trim();
  if (transcript.length < 50) return new Response("transcript too short", { status: 400 });
  const link = body.link && /^https?:\/\//.test(body.link) ? body.link.slice(0, 500) : null;

  const mod = loadModule(drill.module);
  const persona = loadPersona(drill.persona);
  if (!mod?.rubric || !mod.drill || !persona) return new Response("bad module", { status: 400 });
  const seller = founderBySlug(drill.seller_slug ?? drill.founder_slug);
  const buyer = founderBySlug(drill.buyer_slug);
  const rubric = mod.rubric;
  const briefs = drill.briefs;

  await savePairTranscript(drill.id, transcript, link);

  return longJobResponse(async () => {
    const keys = [...sharedArtifactKeys(drill.module), `mindset-assessment-${seller.slug}`];
    const artifacts = (await Promise.all(keys.map((k) => getCurrentArtifact(k)))).filter((a) => a !== null);
    const system = graderSystem({ rules: loadRules(), founder: seller, buyer, mod, persona, artifacts, rawTranscript: true });

    const score: DrillScore = await gradeTranscript(
      system,
      `BUYER BRIEF ${buyer.name} WAS PLAYING FROM (hidden agenda included; use it to judge realism)\n\n${briefs.buyer}\n\nTRANSCRIPT (pasted from the live call; seller = ${seller.name}, buyer = ${buyer.name} as ${persona.name})\n\n${transcript}\n\nReturn the JSON now.`,
    );
    score.max = rubric.max;
    score.below_threshold = score.total < rubric.threshold;

    // Both founders may submit at once. The first grade to finish wins.
    if (!(await saveDrillScore(drill.id, score))) {
      const latest = await getDrill(drill.id);
      return { score: latest?.score ?? score, already: true };
    }
    await addCrmRow({
      founder_slug: seller.slug,
      persona: drill.persona,
      module: drill.module,
      stage: score.crm_row?.stage ?? "unknown",
      key_quotes: score.crm_row?.key_quotes ?? "",
      next_step: score.crm_row?.next_step ?? "none agreed",
      drill_id: drill.id,
    });

    const all = await listDrills({ module: drill.module, founder: seller.slug });
    const best = Math.max(...all.filter((d) => d.score).map((d) => d.score!.total), score.total);
    await bumpProgress(drill.module, seller.slug, "drilled", { best_score: best, max_score: rubric.max, carry_fix: score.fix });
    await unlockNext(drill.module, seller.slug);
    return { score, already: false };
  });
}
