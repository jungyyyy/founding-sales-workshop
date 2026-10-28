import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const supabase = await createClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type === "magiclink") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    ok = !error;
  }
  return NextResponse.redirect(`${origin}${ok ? "/" : "/login?error=auth"}`);
}
