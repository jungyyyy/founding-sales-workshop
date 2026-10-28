"use server";
import { revalidatePath } from "next/cache";
import { isIndividualKey } from "@/lib/founders";
import { acceptArtifact, addNote, requireFounder, resolveNote, saveArtifactVersion, getCurrentArtifact } from "@/lib/db";

export async function saveEdit(key: string, content: string, title: string) {
  const { founder } = await requireFounder();
  const current = await getCurrentArtifact(key);
  const individual = isIndividualKey(key);
  await saveArtifactVersion({
    key,
    title: title || current?.title || key,
    content,
    module: current?.module ?? null,
    createdBy: founder.slug,
    isDraft: !individual, // a manual edit to a shared artifact needs the other founder's acceptance again
  });
  revalidatePath(`/artifacts/${key}`);
  revalidatePath("/artifacts");
}

export async function accept(id: number, key: string) {
  const { founder } = await requireFounder();
  await acceptArtifact(id, founder.slug);
  revalidatePath(`/artifacts/${key}`);
  revalidatePath("/artifacts");
}

export async function comment(artifactId: number, key: string, body: string) {
  const { founder } = await requireFounder();
  if (body.trim()) await addNote(artifactId, founder.slug, body.trim());
  revalidatePath(`/artifacts/${key}`);
}

export async function toggleNote(id: number, resolved: boolean, key: string) {
  await requireFounder();
  await resolveNote(id, resolved);
  revalidatePath(`/artifacts/${key}`);
}
