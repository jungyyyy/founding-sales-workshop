import fs from "node:fs";
import path from "node:path";
import type { ModuleContent, Persona } from "./types";
import { fillCompany } from "./founders";

const ROOT = process.cwd();

export function loadRules(): string {
  return fillCompany(fs.readFileSync(path.join(ROOT, "content", "rules.md"), "utf8"));
}

export function loadModule(n: number): ModuleContent | null {
  const file = path.join(ROOT, "content", "modules", `${String(n).padStart(2, "0")}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fillCompany(fs.readFileSync(file, "utf8"))) as ModuleContent;
}

export function loadAllModules(): ModuleContent[] {
  const dir = path.join(ROOT, "content", "modules");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fillCompany(fs.readFileSync(path.join(dir, f), "utf8"))) as ModuleContent);
}

/**
 * Keys of the shared artifacts the modules build, in module order, optionally only up to a module.
 * The grader reads these so a drill is scored against everything the founders have built so far.
 */
export function sharedArtifactKeys(upTo?: number): string[] {
  const keys: string[] = [];
  for (const m of loadAllModules()) {
    if (!m.build?.shared || (upTo !== undefined && m.number > upTo)) continue;
    for (const k of [m.build.artifact_key, m.build.secondary_artifact_key]) if (k && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

export function loadPersona(key: string): Persona | null {
  const file = path.join(ROOT, "personas", `${key}.md`);
  if (!fs.existsSync(file)) return null;
  const markdown = fillCompany(fs.readFileSync(file, "utf8"));
  // First line: "# Dana Whitfield — founder, 8-person TikTok Shop agency (Manchester, UK)"
  const heading = markdown.split("\n")[0].replace(/^#\s*/, "");
  const [name, role] = heading.split(/\s[—–-]\s/, 2);
  return { key, name: name?.trim() ?? key, role: role?.trim() ?? "", markdown };
}

export function loadAllPersonas(): Persona[] {
  const dir = path.join(ROOT, "personas");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => loadPersona(f.replace(/\.md$/, "")))
    .filter((p): p is Persona => p !== null);
}

export function loadSeedCompany(): string {
  return fillCompany(fs.readFileSync(path.join(ROOT, "my-company", "company.md"), "utf8"));
}
