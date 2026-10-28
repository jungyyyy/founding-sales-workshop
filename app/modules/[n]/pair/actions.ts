"use server";
import { redirect } from "next/navigation";
import { getAnthropic, EFFORT, MODEL } from "@/lib/anthropic";
import { loadModule, loadPersona, loadRules } from "@/lib/content";
import { createPairDrill, FOUNDERS, getCurrentArtifact, isModuleOpen, listCrm, otherFounder, requireFounder } from "@/lib/db";
import { briefsSystem } from "@/lib/prompts";
import type { FounderSlug, PairBriefs } from "@/lib/types";

function parseBriefs(text: string): PairBriefs {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const obj = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)) as {
    seller_brief_markdown?: string;
    buyer_brief_markdown?: string;
  };
  if (!obj.seller_brief_markdown || !obj.buyer_brief_markdown) throw new Error("briefs missing");
  return { seller: obj.seller_brief_markdown, buyer: obj.buyer_brief_markdown };
}

/** Create a pair drill: generate the two briefs from the persona file and store them on the drill. */
export async function startPairDrill(module: number, formData: FormData) {
  const { founder } = await requireFounder();
  const mod = loadModule(module);
  if (!mod?.drill || !mod.rubric) redirect(`/modules/${module}`);
  if (!(await isModuleOpen(module, founder.slug))) redirect("/");

  const personaKey = String(formData.get("persona") ?? mod.drill.persona);
  const persona = loadPersona(personaKey);
  if (!persona) redirect(`/modules/${module}/pair?error=persona`);

  const sellerSlug = (String(formData.get("seller") ?? founder.slug) as FounderSlug) || founder.slug;
  const seller = FOUNDERS.find((f) => f.slug === sellerSlug) ?? founder;
  const buyer = otherFounder(seller.slug);
  // The seller is the one scored and progressed, so the module must be open for them as well.
  if (seller.slug !== founder.slug && !(await isModuleOpen(module, seller.slug))) redirect(`/modules/${module}/pair?error=seller`);

  const [company, history] = await Promise.all([getCurrentArtifact("company"), listCrm({ persona: persona.key })]);
  const system = briefsSystem({ rules: loadRules(), seller, buyer, persona, mod, company, history });

  let briefs: PairBriefs;
  try {
    const res = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 6000,
      system,
      output_config: { effort: EFFORT.briefs },
      messages: [{ role: "user", content: `Write the seller brief for ${seller.name} and the buyer brief for ${buyer.name}. Return the JSON now.` }],
    });
    if (res.stop_reason === "refusal") throw new Error("refused");
    const text = res.content
      .filter((b): b is { type: "text"; text: string; citations: null } => b.type === "text")
      .map((b) => b.text)
      .join("");
    briefs = parseBriefs(text);
  } catch {
    redirect(`/modules/${module}/pair?error=briefs`);
  }

  const drill = await createPairDrill({ module, persona: persona.key, seller: seller.slug, buyer: buyer.slug, briefs });
  redirect(`/drills/${drill.id}/pair`);
}
