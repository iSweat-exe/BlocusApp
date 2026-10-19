import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { authCookieOptions } from "./cookie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Creates a Supabase client for Client Components (browser only).
 * Not used today: the session cookies are `httpOnly` (`authCookieOptions`), so this client cannot read the
 * session. Do not use it for authenticated calls; read on the server (`src/lib/data/*`) instead.
 */
export const createClient = () =>
  createBrowserClient<Database>(supabaseUrl!, supabaseKey!, { cookieOptions: authCookieOptions });
