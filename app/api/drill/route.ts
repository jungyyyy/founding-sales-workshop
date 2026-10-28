import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, EFFORT, MODEL, THINKING, THINKING_REQUEST_OPTIONS } from "@/lib/anthropic";
import { loadModule, loadPersona, loadRules } from "@/lib/content";
import { getCurrentArtifact, getDrill, listCrm, requireFounder, saveDrillTranscript } from "@/lib/db";
import { buyerSystem } from "@/lib/prompts";
import type { TranscriptTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby ceiling with fluid compute; Pro allows 800

export async function POST(req: Request) {
  const { founder } = await requireFounder();
  const body = (await req.json()) as { drillId: number; message?: string; pairTurn?: TranscriptTurn };
  const drill = await getDrill(body.drillId);
  if (!drill || drill.status !== "live") return new Response("drill not live", { status: 404 });
  const mod = loadModule(drill.module);
  const persona = loadPersona(drill.persona);
  if (!mod?.drill || !persona) return new Response("bad module", { status: 400 });

  // Pair mode: just append the human turn.
  if (drill.mode === "pair") {
    if (!body.pairTurn) return new Response("pairTurn required", { status: 400 });
    await saveDrillTranscript(drill.id, [...drill.transcript, body.pairTurn]);
    return Response.json({ ok: true });
  }

  if (drill.founder_slug !== founder.slug) return new Response("not your drill", { status: 403 });
  if (!body.message) return new Response("message required", { status: 400 });

  const sellerTurn: TranscriptTurn = { role: "seller", content: body.message, ts: new Date().toISOString() };
  const transcript = [...drill.transcript, sellerTurn];

  const [company, history] = await Promise.all([getCurrentArtifact("company"), listCrm({ persona: drill.persona })]);
  const system = buyerSystem({ rules: loadRules(), founder, persona, mod, company, history });

  // Transcript → API messages. Buyer = assistant, seller = user. Opening buyer line becomes a
  // leading assistant turn, which needs a user turn before it: we add a scene-setting line.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `[Scene: ${mod.drill.channel}. The conversation begins.]` }];
  for (const t of transcript) messages.push({ role: t.role === "seller" ? "user" : "assistant", content: t.content });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      let text = "";
      try {
        const s = getAnthropic().messages.stream({
          model: MODEL,
          max_tokens: 4000,
          system,
          messages,
          thinking: THINKING,
          output_config: { effort: EFFORT.buyer },
        }, THINKING_REQUEST_OPTIONS);
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            text += ev.delta.text;
            emit({ type: "text", text: ev.delta.text });
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") {
          text = text || "*checks phone* Sorry, I need to take this. Catch you later.";
          emit({ type: "text", text });
        }
        transcript.push({ role: "buyer", content: text, ts: new Date().toISOString() });
        await saveDrillTranscript(drill.id, transcript);
        emit({ type: "done" });
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
