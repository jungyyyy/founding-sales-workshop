import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { loadModule } from "@/lib/content";
import { toDisplayTurns } from "@/lib/buildDisplay";
import {
  FOUNDERS,
  founderBySlug,
  getBuildSession,
  getCurrentArtifact,
  getOpenSharedSession,
  getOrCreateBuildSession,
  isModuleOpen,
  otherFounder,
  requireFounder,
  seedCompanyIfMissing,
} from "@/lib/db";
import { BuildClient } from "./BuildClient";

export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { n } = await params;
  const { session: sessionParam } = await searchParams;
  const num = Number(n);
  const mod = loadModule(num);
  if (!mod || !mod.build) notFound();
  const { founder } = await requireFounder();
  await seedCompanyIfMissing(founder.slug);

  // ?session=<id> opens a shared session both founders are in. Joining one bypasses the
  // per-founder module lock: the artifact is shared, so the Build is too.
  const shared = sessionParam ? await getBuildSession(Number(sessionParam)) : null;
  if (sessionParam && (!shared || !shared.shared || !shared.participants.includes(founder.slug))) notFound();
  if (!shared && !(await isModuleOpen(num, founder.slug))) redirect("/");

  const artifactKey = mod.build.shared || shared ? mod.build.artifact_key : `${mod.build.artifact_key}-${founder.slug}`;
  const [session, artifact, openShared] = await Promise.all([
    shared ? Promise.resolve(shared) : getOrCreateBuildSession(num, founder.slug),
    getCurrentArtifact(artifactKey),
    shared ? Promise.resolve(null) : getOpenSharedSession(num),
  ]);

  return (
    <Shell founder={founder} wide>
      <BuildClient
        module={num}
        moduleTitle={mod.title}
        sessionId={session.id}
        sessionStatus={session.status}
        initialMessages={toDisplayTurns(session.messages)}
        initialArtifact={artifact ? { title: artifact.title, content: artifact.content, version: artifact.version, is_draft: artifact.is_draft, key: artifact.key } : null}
        artifactKey={artifactKey}
        artifactTitle={mod.build.artifact_title}
        shared={mod.build.shared}
        otherName={otherFounder(founder.slug).name}
        me={founder}
        founders={FOUNDERS}
        sharedSession={!!shared}
        startedBy={shared ? founderBySlug(shared.founder_slug).name : null}
        canStartShared={mod.build.shared}
        sharedInvite={openShared ? { id: openShared.id, startedBy: founderBySlug(openShared.founder_slug).name } : null}
      />
    </Shell>
  );
}
