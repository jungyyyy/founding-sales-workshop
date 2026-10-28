import Link from "next/link";
import { Badge, Card, Shell } from "@/components/Shell";
import { founderBySlug, listCurrentArtifacts, requireFounder, seedCompanyIfMissing } from "@/lib/db";

export default async function ArtifactsPage() {
  const { founder } = await requireFounder();
  await seedCompanyIfMissing(founder.slug);
  const artifacts = await listCurrentArtifacts();
  return (
    <Shell founder={founder}>
      <h1 className="text-xl font-semibold">Artifacts</h1>
      <p className="mt-1 text-sm text-muted">The point of the workshop. Shared ones need both founders; a DRAFT badge means the other founder has not accepted this version.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {artifacts.map((a) => (
          <Link key={a.key} href={`/artifacts/${a.key}`}>
            <Card className="h-full hover:border-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.title}</span>
                {a.is_draft ? <Badge tone="warn">draft</Badge> : <Badge tone="accent">accepted</Badge>}
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                {a.key} · v{a.version} · by {a.authors?.length ? a.authors.map((x) => founderBySlug(x).name).join(" & ") : founderBySlug(a.created_by).name} · {new Date(a.created_at).toLocaleDateString()}
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted">{a.content.replace(/[#*|>-]/g, "").slice(0, 240)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
