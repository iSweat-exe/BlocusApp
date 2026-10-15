import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasVerifiedEmail, isMissingEmailError } from "@/features/auth/email-verification";
import { safeRedirectPath } from "@/features/auth/safe-redirect";
import { recordSignupOrigin } from "@/features/auth/signup-origin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** An account created less than this long ago is a sign-up that was just refused, so it is removed again. */
const JUST_CREATED_MS = 10 * 60_000;

/** Ends the session and, for an account that was created by this very sign-in, removes it. Never throws. */
async function rejectUnverified(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; created_at: string },
) {
  await supabase.auth.signOut();
  if (Date.now() - Date.parse(user.created_at) > JUST_CREATED_MS) return;
  try {
    const { error } = await createServiceClient().auth.admin.deleteUser(user.id);
    if (error) console.error("Unverified account not removed:", error.code ?? error.name);
  } catch (cause) {
    console.error(
      "Unverified account not removed:",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}

/**
 * OAuth callback: exchanges the PKCE `code` for a session stored in httpOnly cookies. A sign-in whose e-mail
 * address is missing or not verified by the provider is refused (session ended, brand-new account removed).
 * When the sign-in just created the account, it also notes where the request came from (admin user page).
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
    if (!error && data?.user && !hasVerifiedEmail(data.user)) {
      await rejectUnverified(supabase, data.user);
      return NextResponse.redirect(`${origin}/login?error=email_not_verified`);
    }
    if (!error) {
      await recordSignupOrigin(data?.user, request.headers);
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Reason only (no code, no token): it is the one clue to why a sign-in failed.
    console.error("OAuth code exchange failed:", error.code ?? error.name, error.message);
  } else {
    const description = searchParams.get("error_description");
    console.error("OAuth callback without a code:", description ?? "none");
    // The provider gave no usable e-mail address (Discord account without one): say so instead of "failed".
    if (isMissingEmailError(description)) {
      return NextResponse.redirect(`${origin}/login?error=email_not_verified`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_callback`);
}
