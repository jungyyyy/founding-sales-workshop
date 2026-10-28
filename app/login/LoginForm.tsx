"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLOWED = (process.env.NEXT_PUBLIC_FOUNDER_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (ALLOWED.length && !ALLOWED.includes(addr)) {
      setState("error");
      setMsg("That email is not on the founder allowlist.");
      return;
    }
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      // The database trigger rejects non-allowlisted emails at user creation.
      setMsg(/database error|not allowed/i.test(error.message) ? "That email is not on the founder allowlist." : error.message);
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return <p className="mt-4 rounded bg-accent-soft px-3 py-2 text-sm text-accent">Check your inbox for the magic link. You can close this tab.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your founder email"
        className="rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        disabled={state === "sending"}
        className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {state === "error" && <p className="text-sm text-warn">{msg}</p>}
    </form>
  );
}
