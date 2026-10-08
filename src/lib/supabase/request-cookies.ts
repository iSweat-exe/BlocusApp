import { io } from "next/cache";
import { cookies } from "next/headers";

/**
 * The request's cookies, for `createClient()` in code that runs while rendering a page.
 *
 * Creating a Supabase client starts a session check that reads the clock (`Date.now()`), which Cache
 * Components rejects while prerendering ("blocking-prerender-current-time"). `await io()` keeps that
 * work out of the static shell; during a real request it resolves immediately.
 */
export async function requestCookies() {
  await io();
  return cookies();
}
