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
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_callback`);
}
