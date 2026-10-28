import Link from "next/link";
import { FOUNDERS } from "@/lib/db";

/** Link-based filter: ?founder=<slug> | (none = both). */
export function FounderFilter({ base, current }: { base: string; current: string | undefined }) {
  const opts = [{ slug: undefined, name: "Both" }, ...FOUNDERS];
  return (
    <div className="flex gap-1 text-xs">
      {opts.map((o) => {
        const active = (o.slug ?? "") === (current ?? "");
        return (
          <Link
            key={o.name}
            href={o.slug ? `${base}?founder=${o.slug}` : base}
            className={`rounded-full border px-2.5 py-0.5 ${active ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {o.name}
          </Link>
        );
      })}
    </div>
  );
}
