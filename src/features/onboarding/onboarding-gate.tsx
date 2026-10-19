import { getSessionPermissions } from "@/server/session";
import { Onboarding } from "./onboarding";

/**
 * Mounts the onboarding for signed-in people only (Guests are read-only visitors: no account, no
 * notifications). Reads cookies, like the header (the session read is shared): wrap in Suspense.
 */
export async function OnboardingGate() {
  const session = await getSessionPermissions();
  if (!session) return null;
  return <Onboarding vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />;
}
