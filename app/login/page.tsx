import { COMPANY } from "@/lib/founders";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Founding Sales Workshop</h1>
        <p className="mt-1 text-sm text-muted">{COMPANY} founders only. Enter your email to get a magic link.</p>
        {error === "not-allowed" && (
          <p className="mt-3 rounded bg-warn-soft px-3 py-2 text-sm text-warn">That email is not on the founder allowlist.</p>
        )}
        {error === "auth" && <p className="mt-3 rounded bg-warn-soft px-3 py-2 text-sm text-warn">The link did not work. Request a new one.</p>}
        <LoginForm />
      </div>
    </div>
  );
}
