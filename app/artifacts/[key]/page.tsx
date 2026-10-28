import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { founderBySlug, listArtifactVersions, listNotes, requireFounder } from "@/lib/db";
import { ArtifactClient } from "./ArtifactClient";

export default async function ArtifactPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { founder } = await requireFounder();
  const versions = await listArtifactVersions(key);
  if (!versions.length) notFound();
  const current = versions[0];
  const notes = await listNotes(versions.map((v) => v.id));

  return (
    <Shell founder={founder} wide>
      <div className="mb-3 text-sm">
        <Link href="/artifacts" className="text-muted hover:text-foreground">
          ← Artifacts
        </Link>
      </div>
      <ArtifactClient
        current={current}
        versions={versions.map((v) => ({
          id: v.id,
          version: v.version,
          created_by: v.authors?.length ? v.authors.map((a) => founderBySlug(a).name).join(" & ") : founderBySlug(v.created_by).name,
          created_at: v.created_at,
          is_draft: v.is_draft,
        }))}
        notes={notes.map((n) => ({ ...n, author: founderBySlug(n.founder_slug).name }))}
        viewer={founder}
        canAccept={current.is_draft && current.created_by !== founder.slug}
        createdByName={current.authors?.length ? current.authors.map((a) => founderBySlug(a).name).join(" & ") : founderBySlug(current.created_by).name}
        acceptedByName={current.accepted_by ? founderBySlug(current.accepted_by).name : null}
      />
    </Shell>
  );
}
