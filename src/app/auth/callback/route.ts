import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/features/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/** OAuth callback: exchanges the PKCE `code` for a session stored in httpOnly cookies. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // Reason only (no code, no token): it is the one clue to why a sign-in failed.
    console.error("OAuth code exchange failed:", error.code ?? error.name, error.message);
  } else {
    console.error(
      "OAuth callback without a code:",
      searchParams.get("error_description") ?? "none",
    );
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_callback`);
}
