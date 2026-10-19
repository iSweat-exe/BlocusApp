import Link from "next/link";
import { getSessionPermissions } from "@/server/session";
import { PushSettings } from "./push-settings";

/**
 * "Notifications" group of the settings. Reads cookies (who is signed in). Guests are sent to the login, because
 * a subscription belongs to an account; the section is hidden when the server has no VAPID key (push is off).
 */
export async function NotificationsSection() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return null;

  const session = await getSessionPermissions();
  return (
    <section aria-labelledby="notifications-title" className="flex flex-col gap-2">
      <h2 id="notifications-title" className="section-title">
        Notifications
      </h2>
      {session ? (
        <PushSettings vapidPublicKey={vapidPublicKey} />
      ) : (
        <p className="card px-4 py-3 text-sm text-muted">
          <Link href="/login" prefetch={false} className="font-medium text-accent">
            Connecte-toi
          </Link>{" "}
          pour recevoir une notification à chaque nouveau post.
        </p>
      )}
    </section>
  );
}
