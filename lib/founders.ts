import config from "@/content/founders.json";
import type { Founder, FounderSlug } from "./types";

/**
 * Who is in the workshop. Edit content/founders.json (and the founders rows in
 * supabase/migrations/0001_init.sql) to change the company name or the two founders.
 * Slugs are lowercase identifiers used as database keys; names are what the coach says.
 */
export const COMPANY: string = config.company;
export const FOUNDERS: Founder[] = config.founders;

export function founderBySlug(slug: string | null | undefined): Founder {
  return FOUNDERS.find((f) => f.slug === slug) ?? { slug: (slug ?? "unknown") as FounderSlug, name: slug ?? "Unknown" };
}

export function otherFounder(slug: FounderSlug): Founder {
  return FOUNDERS.find((f) => f.slug !== slug) ?? FOUNDERS[0];
}

/** True for a per-founder artifact key such as "mindset-assessment-<slug>". */
export function isIndividualKey(key: string): boolean {
  return FOUNDERS.some((f) => key.endsWith(`-${f.slug}`));
}

/** Replace the {{company}}, {{founder_1}} and {{founder_2}} placeholders the curriculum files use. */
export function fillCompany(text: string): string {
  let out = text.replaceAll("{{company}}", COMPANY);
  FOUNDERS.forEach((f, i) => {
    out = out.replaceAll(`{{founder_${i + 1}}}`, f.name);
  });
  return out;
}
