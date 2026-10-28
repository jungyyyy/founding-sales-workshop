import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { loadAllModules, loadSeedCompany } from "./content";
import type {
  Artifact,
  ArtifactNote,
  BuildSession,
  CrmRow,
  Drill,
  Founder,
  FounderSlug,
  PairBriefs,
  ProgressRow,
  ProgressStatus,
} from "./types";

import { COMPANY, FOUNDERS, founderBySlug } from "./founders";
export { FOUNDERS, founderBySlug, otherFounder } from "./founders";

/** The logged-in founder, or redirect to /login. */
export async function requireFounder(): Promise<{ founder: Founder; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("founder_logins").select("founder_slug").eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/login?error=not-allowed");
  return { founder: founderBySlug(data.founder_slug), email: user.email ?? "" };
}

// ---------- artifacts ----------
export async function getCurrentArtifact(key: string): Promise<Artifact | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("artifacts_current").select("*").eq("key", key).maybeSingle();
  return (data as Artifact | null) ?? null;
}

export async function listCurrentArtifacts(): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("artifacts_current").select("*").order("key");
  return (data as Artifact[]) ?? [];
}

export async function listArtifactVersions(key: string): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("artifacts").select("*").eq("key", key).order("version", { ascending: false });
  return (data as Artifact[]) ?? [];
}

export async function saveArtifactVersion(args: {
  key: string;
  title: string;
  content: string;
  module: number | null;
  createdBy: FounderSlug;
  isDraft: boolean;
  /** Shared build session: both founders co-authored it, so it is accepted on write. */
  authors?: FounderSlug[];
}): Promise<Artifact> {
  const supabase = await createClient();
  const current = await getCurrentArtifact(args.key);
  const version = (current?.version ?? 0) + 1;
  const coAuthor = args.authors?.find((a) => a !== args.createdBy) ?? null;
  const { data, error } = await supabase
    .from("artifacts")
    .insert({
      key: args.key,
      version,
      title: args.title,
      content: args.content,
      module: args.module,
      created_by: args.createdBy,
      is_draft: coAuthor ? false : args.isDraft,
      authors: args.authors ?? null,
      accepted_by: coAuthor,
      accepted_at: coAuthor ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Artifact;
}

export async function acceptArtifact(id: number, by: FounderSlug): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("artifacts")
    .update({ is_draft: false, accepted_by: by, accepted_at: new Date().toISOString() })
    .eq("id", id)
    .neq("created_by", by);
  if (error) throw error;
}

export async function listNotes(artifactIds: number[]): Promise<ArtifactNote[]> {
  if (!artifactIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("artifact_notes").select("*").in("artifact_id", artifactIds).order("created_at");
  return (data as ArtifactNote[]) ?? [];
}

export async function addNote(artifactId: number, by: FounderSlug, body: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("artifact_notes").insert({ artifact_id: artifactId, founder_slug: by, body });
  if (error) throw error;
}

export async function resolveNote(id: number, resolved: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("artifact_notes").update({ resolved }).eq("id", id);
}

/** Seed the company artifact from my-company/company.md if the table is empty. */
export async function seedCompanyIfMissing(by: FounderSlug): Promise<Artifact> {
  const existing = await getCurrentArtifact("company");
  if (existing) return existing;
  return saveArtifactVersion({
    key: "company",
    title: `${COMPANY} — company & narrative`,
    content: loadSeedCompany(),
    module: null,
    createdBy: by,
    isDraft: true,
  });
}

/** Standing fixes = the two lowest mindsets, read from the founder's mindset assessment. */
export async function getStandingFixes(slug: FounderSlug): Promise<string[]> {
  const a = await getCurrentArtifact(`mindset-assessment-${slug}`);
  if (!a) return [];
  const m = a.content.match(/## Standing fixes\s*\n([\s\S]*?)(\n## |$)/);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*(\d+\.|-)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 2);
}

// ---------- build sessions ----------
export async function getOrCreateBuildSession(module: number, slug: FounderSlug): Promise<BuildSession> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("build_sessions")
    .select("*")
    .eq("module", module)
    .eq("founder_slug", slug)
    .eq("shared", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return data as BuildSession;
  const { data: created, error } = await supabase
    .from("build_sessions")
    .insert({ module, founder_slug: slug })
    .select("*")
    .single();
  if (error) throw error;
  return created as BuildSession;
}

export async function getBuildSession(id: number): Promise<BuildSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("build_sessions").select("*").eq("id", id).maybeSingle();
  return (data as BuildSession | null) ?? null;
}

/**
 * Save the chat. `expectUpdatedAt` makes the write conditional (shared sessions): if the other
 * founder's request landed first, nothing is written and false is returned.
 */
export async function saveBuildMessages(
  id: number,
  messages: BuildSession["messages"],
  status?: "open" | "done",
  expectUpdatedAt?: string,
): Promise<boolean> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { messages, updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  let q = supabase.from("build_sessions").update(patch).eq("id", id);
  if (expectUpdatedAt) q = q.eq("updated_at", expectUpdatedAt);
  const { data, error } = await q.select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** The open shared session for a module, if any (there is at most one at a time). */
export async function getOpenSharedSession(module: number): Promise<BuildSession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("build_sessions")
    .select("*")
    .eq("module", module)
    .eq("shared", true)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BuildSession | null) ?? null;
}

export async function listOpenSharedSessions(): Promise<BuildSession[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("build_sessions")
    .select("*")
    .eq("shared", true)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return (data as BuildSession[]) ?? [];
}

export async function createSharedSession(module: number, startedBy: FounderSlug): Promise<BuildSession> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("build_sessions")
    .insert({ module, founder_slug: startedBy, shared: true, participants: FOUNDERS.map((f) => f.slug) })
    .select("*")
    .single();
  if (error) throw error;
  return data as BuildSession;
}

export async function closeSharedSession(id: number) {
  const supabase = await createClient();
  await supabase.from("build_sessions").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", id);
}

export async function resetBuildSession(module: number, slug: FounderSlug) {
  const supabase = await createClient();
  await supabase.from("build_sessions").insert({ module, founder_slug: slug });
}

// ---------- drills ----------
export async function createDrill(args: {
  module: number;
  persona: string;
  founder: FounderSlug;
  mode: "solo" | "pair";
  buyer: FounderSlug | null;
  opening: string | null;
}): Promise<Drill> {
  const supabase = await createClient();
  const transcript = args.opening ? [{ role: "buyer", content: args.opening, ts: new Date().toISOString() }] : [];
  const { data, error } = await supabase
    .from("drills")
    .insert({
      module: args.module,
      persona: args.persona,
      founder_slug: args.founder,
      mode: args.mode,
      buyer_slug: args.buyer,
      transcript,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Drill;
}

export async function createPairDrill(args: {
  module: number;
  persona: string;
  seller: FounderSlug;
  buyer: FounderSlug;
  briefs: PairBriefs;
}): Promise<Drill> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drills")
    .insert({
      module: args.module,
      persona: args.persona,
      founder_slug: args.seller,
      seller_slug: args.seller,
      buyer_slug: args.buyer,
      participants: [args.seller, args.buyer],
      mode: "pair",
      briefs: args.briefs,
      transcript: [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Drill;
}

export async function savePairTranscript(id: number, text: string, link: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("drills").update({ transcript_text: text, transcript_link: link }).eq("id", id);
  if (error) throw error;
}

/** Live pair drills that still need a transcript and a debrief. */
export async function listOpenPairDrills(): Promise<Drill[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drills")
    .select("*")
    .eq("mode", "pair")
    .eq("status", "live")
    .not("briefs", "is", null)
    .order("started_at", { ascending: false });
  return (data as Drill[]) ?? [];
}

export async function getDrill(id: number): Promise<Drill | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("drills").select("*").eq("id", id).maybeSingle();
  return (data as Drill | null) ?? null;
}

export async function listDrills(filter?: { module?: number; founder?: FounderSlug }): Promise<Drill[]> {
  const supabase = await createClient();
  let q = supabase.from("drills").select("*").order("started_at", { ascending: false });
  if (filter?.module) q = q.eq("module", filter.module);
  if (filter?.founder) q = q.eq("founder_slug", filter.founder);
  const { data } = await q;
  return (data as Drill[]) ?? [];
}

export async function saveDrillTranscript(id: number, transcript: Drill["transcript"]) {
  const supabase = await createClient();
  const { error } = await supabase.from("drills").update({ transcript }).eq("id", id);
  if (error) throw error;
}

/** Score a live drill. Returns false if it was already debriefed (a second grade finished first). */
export async function saveDrillScore(id: number, score: Drill["score"]): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drills")
    .update({ score, status: "debriefed", debriefed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "live")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ---------- crm ----------
export async function listCrm(filter?: { persona?: string }): Promise<CrmRow[]> {
  const supabase = await createClient();
  let q = supabase.from("crm_log").select("*").order("date", { ascending: false }).order("id", { ascending: false });
  if (filter?.persona) q = q.eq("persona", filter.persona);
  const { data } = await q;
  return (data as CrmRow[]) ?? [];
}

export async function addCrmRow(row: Omit<CrmRow, "id" | "date"> & { date?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_log").insert(row);
  if (error) throw error;
}

// ---------- progress ----------
export async function listProgress(): Promise<ProgressRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("progress").select("*").order("module");
  return (data as ProgressRow[]) ?? [];
}

const ORDER: ProgressStatus[] = ["locked", "open", "briefed", "built", "drilled", "done"];

/** Move a founder's module status forward (never backwards). */
export async function bumpProgress(module: number, slug: FounderSlug, status: ProgressStatus, extra?: Partial<ProgressRow>) {
  const supabase = await createClient();
  const { data } = await supabase.from("progress").select("*").eq("module", module).eq("founder_slug", slug).maybeSingle();
  const current = (data as ProgressRow | null)?.status ?? "locked";
  const next = ORDER.indexOf(status) > ORDER.indexOf(current) ? status : current;
  const { error } = await supabase.from("progress").upsert(
    { module, founder_slug: slug, status: next, ...extra, updated_at: new Date().toISOString() },
    { onConflict: "module,founder_slug" },
  );
  if (error) throw error;
}

/** Unlock rule: a debriefed drill in module N opens module N+1 for that founder. */
export async function unlockNext(module: number, slug: FounderSlug) {
  const modules = loadAllModules();
  const next = modules.find((m) => m.number === module + 1);
  if (!next) return;
  await bumpProgress(module + 1, slug, "open");
}

export async function isModuleOpen(module: number, slug: FounderSlug): Promise<boolean> {
  if (module === 1) return true;
  const rows = await listProgress();
  const row = rows.find((r) => r.module === module && r.founder_slug === slug);
  return !!row && row.status !== "locked";
}
