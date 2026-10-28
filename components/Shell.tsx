import Link from "next/link";
import type { Founder } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/artifacts", label: "Artifacts" },
  { href: "/crm", label: "CRM" },
  { href: "/progress", label: "Progress" },
];

export function Shell({ founder, children, wide = false }: { founder: Founder; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card">
        <div className={`mx-auto flex ${wide ? "max-w-[1400px]" : "max-w-5xl"} items-center justify-between px-4 py-3`}>
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              Founding Sales Workshop
            </Link>
            <nav className="hidden gap-4 text-sm text-muted sm:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">{founder.name}</span>
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full ${wide ? "max-w-[1400px]" : "max-w-5xl"} flex-1 px-4 py-6`}>{children}</main>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const cls =
    tone === "accent"
      ? "bg-accent-soft text-accent"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : "bg-border text-muted";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${cls}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>{children}</div>;
}
