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
  unlockNext,
} from "@/lib/db";
import { gradeTranscript, longJobResponse } from "@/lib/grader";
import { graderSystem, transcriptForGrader } from "@/lib/prompts";
import type { DrillScore } from "@/lib/types";

export const runtime = "nodejs";
// Grading runs at high effort and can take a few minutes on a long transcript. 300 s is the
// ceiling on Vercel Hobby with fluid compute (default for new projects); Pro allows 800.
export const maxDuration = 300;

export async function POST(req: Request) {
  const { founder: viewer } = await requireFounder();
  const { drillId } = (await req.json()) as { drillId: number };
  const drill = await getDrill(drillId);
  if (!drill) return new Response("not found", { status: 404 });
  if (drill.founder_slug !== viewer.slug && !drill.participants?.includes(viewer.slug)) return new Response("not your drill", { status: 403 });
  if (drill.status === "debriefed") return Response.json({ ok: true, already: true });
  const mod = loadModule(drill.module);
  const persona = loadPersona(drill.persona);
  if (!mod?.rubric || !mod.drill || !persona) return new Response("bad module", { status: 400 });
  const seller = founderBySlug(drill.founder_slug);
  const buyer = drill.mode === "pair" ? founderBySlug(drill.buyer_slug) : null;
  const rubric = mod.rubric;

  return longJobResponse(async () => {
    const keys = [...sharedArtifactKeys(drill.module), `mindset-assessment-${seller.slug}`];
    const artifacts = (await Promise.all(keys.map((k) => getCurrentArtifact(k)))).filter((a) => a !== null);
    const system = graderSystem({ rules: loadRules(), founder: seller, buyer, mod, persona, artifacts });

    const score: DrillScore = await gradeTranscript(system, `TRANSCRIPT\n\n${transcriptForGrader(drill, seller, persona.name)}\n\nReturn the JSON now.`);
    score.max = rubric.max;
    score.below_threshold = score.total < rubric.threshold;

    // The Debrief button may have been pressed more than once. The first grade to finish wins;
    // a later one must not write a second score or CRM row.
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
