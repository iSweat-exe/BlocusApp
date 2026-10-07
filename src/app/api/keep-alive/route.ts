import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Daily keep-alive (Vercel Cron, see `vercel.json`): one tiny read so that the free Supabase project is never
 * paused after 7 days without activity. When `CRON_SECRET` is set (Vercel sends it as a bearer token to its cron
 * jobs) any other caller is refused; without it the route stays open, which is harmless (one row, no data
 * returned) but lets anybody spend function invocations.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  try {
    const { error } = await createPublicClient().from("events").select("id").limit(1);
    if (error) return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
