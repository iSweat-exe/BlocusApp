import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends the current session and sends the user back to the login page.
 *
 * A plain POST Route Handler instead of a Server Action: the sign-out button is a normal form that works
 * without JavaScript and in installed PWAs, and the response is an ordinary redirect (a Server Action
 * redirect answers in the RSC format, which fails with "An unexpected response was received from the server"
 * when the client and the server disagree). `SameSite=Lax` session cookies are not sent on cross-site POSTs.
 */
export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  // 303: the browser follows a POST redirect with a GET.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
