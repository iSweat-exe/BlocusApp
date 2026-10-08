import { createServiceClient } from "@/lib/supabase/service";
import { collectHealth, recordReport } from "./collect";

/**
 * Measures the back end and stores a snapshot, for the daily cron: nobody is signed in, so it uses the service
 * role. Without `SUPABASE_SERVICE_ROLE_KEY` it does nothing, and it never throws (the cron's real job, the
 * keep-alive read, must not fail because of monitoring).
 * @returns Whether a snapshot was written.
 */
export async function recordCronSnapshot(): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const client = createServiceClient();
    const result = await recordReport(client, await collectHealth(client), "cron");
    return result.ok && result.value;
  } catch {
    return false;
  }
}
