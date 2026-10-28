"use server";
import { redirect } from "next/navigation";
import { loadModule } from "@/lib/content";
import { closeSharedSession, createSharedSession, getBuildSession, getOpenSharedSession, requireFounder } from "@/lib/db";

/** Open (or join) the shared build session for a module. One open shared session per module. */
export async function startSharedSession(module: number) {
  const { founder } = await requireFounder();
  const mod = loadModule(module);
  if (!mod?.build?.shared) redirect(`/modules/${module}?tab=build`);
  const existing = await getOpenSharedSession(module);
  const session = existing ?? (await createSharedSession(module, founder.slug));
  redirect(`/modules/${module}/build?session=${session.id}`);
}

/** End a shared session for both founders. The artifact keeps its last saved version. */
export async function endSharedSession(sessionId: number) {
  const { founder } = await requireFounder();
  const session = await getBuildSession(sessionId);
  if (!session || !session.shared || !session.participants.includes(founder.slug)) redirect("/");
  await closeSharedSession(sessionId);
  redirect(`/modules/${session.module}?tab=build`);
}
