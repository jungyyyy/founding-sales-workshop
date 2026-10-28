import { loadModule } from "@/lib/content";
import { getBuildSession, getCurrentArtifact, requireFounder } from "@/lib/db";
import { toDisplayTurns } from "@/lib/buildDisplay";

export const runtime = "nodejs";

/** Current state of a build session, used by shared-session clients to resync after each turn. */
export async function GET(req: Request) {
  const { founder } = await requireFounder();
  const id = Number(new URL(req.url).searchParams.get("id"));
  const session = await getBuildSession(id);
  if (!session) return new Response("not found", { status: 404 });
  const allowed = session.shared ? session.participants.includes(founder.slug) : session.founder_slug === founder.slug;
  if (!allowed) return new Response("not found", { status: 404 });
  const mod = loadModule(session.module);
  if (!mod?.build) return new Response("bad module", { status: 400 });
  const artifactKey = mod.build.shared || session.shared ? mod.build.artifact_key : `${mod.build.artifact_key}-${founder.slug}`;
  const artifact = await getCurrentArtifact(artifactKey);
  return Response.json({
    status: session.status,
    messages: toDisplayTurns(session.messages),
    artifact: artifact ? { key: artifact.key, title: artifact.title, content: artifact.content, version: artifact.version, is_draft: artifact.is_draft } : null,
  });
}
