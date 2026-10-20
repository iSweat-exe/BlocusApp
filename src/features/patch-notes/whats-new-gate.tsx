import { getSessionPermissions } from "@/server/session";
import { WhatsNew } from "./whats-new";

/**
 * Mounts the "what's new" screen for everybody (the patch notes are public). It only needs to know whether there is
 * a session, to let a newcomer finish the onboarding first. Reads cookies, like the onboarding gate (the session
 * read is shared): wrap in Suspense.
 */
export async function WhatsNewGate() {
  const session = await getSessionPermissions();
  return <WhatsNew signedIn={session !== null} />;
}
