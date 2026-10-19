import { NextResponse } from "next/server";
import { exportFileName } from "@/features/legal/my-data";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Downloads everything the application holds about the signed-in user, as a JSON file (GDPR right of access and
 * portability). The document is built by the database function `export_my_data()`, which only ever reads the
 * caller's own rows (their id comes from the session). `401` for a Guest. Never cached: it is personal data.
 */
export async function GET() {
  const supabase = createClient(await requestCookies());
  const { data, error } = await supabase.rpc("export_my_data");

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
    }
    logActionError("exportMyData", error);
    return NextResponse.json({ error: "export_failed" }, { status: 500, headers: NO_STORE });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName()}"`,
    },
  });
}
