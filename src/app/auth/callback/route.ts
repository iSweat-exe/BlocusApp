import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/features/auth/safe-redirect";
import { recordSignupOrigin } from "@/features/auth/signup-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback: exchanges the PKCE `code` for a session stored in httpOnly cookies. When the sign-in just
 * created the account, it also notes where the request came from (admin user page).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  // Added by the Supabase client to the `redirectTo` of each OAuth start: selects that flow's PKCE verifier.
  // Absent on callbacks of flows started before this was enabled: the latest verifier is used then.
  const flowId = searchParams.get("sb_flow_id");

  if (code) {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      await recordSignupOrigin(data?.user, request.headers);
      return NextResponse.redirect(`${origin}${next}`);
    }
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
