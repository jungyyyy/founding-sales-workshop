import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, EFFORT, MODEL, THINKING, THINKING_REQUEST_OPTIONS } from "@/lib/anthropic";
import { loadModule, loadRules, sharedArtifactKeys } from "@/lib/content";
import {
  bumpProgress,
  getBuildSession,
  getCurrentArtifact,
  getStandingFixes,
  otherFounder,
  requireFounder,
  saveArtifactVersion,
  saveBuildMessages,
} from "@/lib/db";
import { coachSystem, UPDATE_ARTIFACT_TOOL } from "@/lib/prompts";
import { tagSpeaker } from "@/lib/buildDisplay";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby ceiling with fluid compute; Pro allows 800

type ArtifactInput = { key: string; title: string; content_markdown: string; done: boolean };

function isArtifactInput(x: unknown): x is ArtifactInput {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.key === "string" && typeof o.title === "string" && typeof o.content_markdown === "string" && typeof o.done === "boolean";
}

export async function POST(req: Request) {
  const { founder } = await requireFounder();
  const body = (await req.json()) as { sessionId: number; module: number; message: string | null; otherPresent: boolean };
  const mod = loadModule(body.module);
  if (!mod?.build) return new Response("module has no build phase", { status: 400 });
  const session = await getBuildSession(body.sessionId);
  if (!session) return new Response("session not found", { status: 404 });
  const shared = session.shared;
  const allowed = shared ? session.participants.includes(founder.slug) : session.founder_slug === founder.slug;
  if (!allowed) return new Response("session not found", { status: 404 });
  if (session.status === "done") return new Response("session is finished", { status: 409 });
  const otherPresent = shared ? true : body.otherPresent;

  const artifactKey = mod.build.shared ? mod.build.artifact_key : `${mod.build.artifact_key}-${founder.slug}`;
  // Earlier modules' shared artifacts: the spec tells the coach to pull from them by name.
  const priorKeys = sharedArtifactKeys(mod.number - 1).filter((k) => k !== "company" && k !== artifactKey);
  const [company, artifact, fixes, prior] = await Promise.all([
    getCurrentArtifact("company"),
    getCurrentArtifact(artifactKey),
    getStandingFixes(founder.slug),
    Promise.all(priorKeys.map((k) => getCurrentArtifact(k))),
  ]);
  const priorArtifacts = prior.filter((a) => a !== null);

  const system = coachSystem({
    rules: loadRules(),
    founder,
    otherPresent,
    mod,
    company,
    artifact,
    artifactKey,
    priorArtifacts,
    standingFixes: fixes,
    shared,
  });

  // Build the new user turn. If the previous assistant turn ended in a tool_use, the
  // tool_result must open this user message.
  const history: Anthropic.MessageParam[] = [...session.messages];
  const last = history[history.length - 1];
  const pendingToolUses =
    last?.role === "assistant" && Array.isArray(last.content)
      ? last.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      : [];
  const userBlocks: Anthropic.ContentBlockParam[] = pendingToolUses.map((t) => ({
    type: "tool_result",
    tool_use_id: t.id,
    content: "Saved.",
  }));
  const text = body.message ? (shared ? tagSpeaker(founder.name, body.message) : body.message) : "Let's start.";
  userBlocks.push({ type: "text", text });
  history.push({ role: "user", content: userBlocks });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        let newStatus: "open" | "done" | undefined;
        let emittedText = false;
        // Agentic loop: when the coach records the artifact (tool_use), feed the result back and
        // let it continue, so the founder always gets a reply after a save. Bounded so a runaway
        // model cannot loop; if the cap is hit, the pending tool_use is settled on the next request.
        const MAX_ROUNDS = 4;
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const s = getAnthropic().messages.stream({
            model: MODEL,
            max_tokens: 16000,
            system,
            messages: history,
            tools: [UPDATE_ARTIFACT_TOOL],
            thinking: THINKING,
            output_config: { effort: EFFORT.coach },
          }, THINKING_REQUEST_OPTIONS);
          let roundText = false;
          for await (const ev of s) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              if (!roundText && emittedText) emit({ type: "text", text: "\n\n" });
              roundText = emittedText = true;
              emit({ type: "text", text: ev.delta.text });
            }
          }
          const final = await s.finalMessage();
          if (final.stop_reason === "refusal") emit({ type: "error", message: "The coach declined to answer. Try rephrasing." });

          // Persist the full content (thinking blocks included) so later requests replay it unchanged.
          history.push({ role: "assistant", content: final.content });

          const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          if (final.stop_reason !== "tool_use" || toolUses.length === 0) break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const block of toolUses) {
            if (block.name !== "update_artifact" || !isArtifactInput(block.input)) {
              emit({ type: "error", message: "Artifact update was malformed; nothing saved." });
              results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: "Malformed input; nothing saved. Reply to the founder in text." });
              continue;
            }
            // The coach may write the module's artifact or the secondary one its spec names
            // (e.g. "pricing" alongside "company"); anything else must not overwrite either.
            const secondaryKey = mod.build!.shared ? mod.build!.secondary_artifact_key : undefined;
            const isSecondary = !!secondaryKey && block.input.key === secondaryKey;
            if (block.input.key !== artifactKey && !isSecondary) {
              const allowed = [artifactKey, secondaryKey].filter(Boolean).map((k) => `'${k}'`).join(" or ");
              results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: `Unknown artifact key '${block.input.key}'. Nothing saved. Use ${allowed}.` });
              continue;
            }
            const saved = await saveArtifactVersion({
              key: isSecondary ? secondaryKey! : artifactKey,
              title: block.input.title || (isSecondary ? mod.build!.secondary_artifact_title ?? secondaryKey! : mod.build!.artifact_title),
              content: block.input.content_markdown,
              module: mod.number,
              createdBy: founder.slug,
              // Shared artifacts with both founders present can be accepted outright; otherwise draft.
              isDraft: mod.build!.shared ? !otherPresent : false,
              // Shared session: both founders are authors and the version is accepted on write.
              authors: shared ? session.participants : undefined,
            });
            emit({ type: "artifact", artifact: { key: saved.key, title: saved.title, content: saved.content, version: saved.version, is_draft: saved.is_draft }, done: block.input.done });
            for (const slug of shared ? session.participants : [founder.slug]) {
              await bumpProgress(mod.number, slug, block.input.done ? "built" : "briefed");
            }
            if (block.input.done) newStatus = "done";
            results.push({ type: "tool_result", tool_use_id: block.id, content: "Saved. The founder sees the updated artifact. Now reply to them in text." });
          }
          // At the cap, leave the tool_use pending; the next request opens with its tool_result.
          if (round === MAX_ROUNDS - 1) break;
          history.push({ role: "user", content: results });
        }
        // In a shared session the write is conditional: if the other founder's turn landed first,
        // this one is not persisted and the client is told to reload.
        const saved = await saveBuildMessages(session.id, history, newStatus, shared ? session.updated_at : undefined);
        if (!saved) emit({ type: "error", message: `Your message crossed with ${otherFounder(founder.slug).name}'s. Reload to see the latest, then send again.` });
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
