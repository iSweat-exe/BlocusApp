"use client";

import { useEffect, useRef, useState } from "react";
import { removePushSubscription, savePushSubscription } from "./actions";
import { detectPushSupport, urlBase64ToUint8Array } from "./device";

/** What the control shows. */
type View = "checking" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

const COPY: Record<"unsupported" | "needs-install" | "blocked", string> = {
  unsupported: "Ton navigateur ne permet pas les notifications de l'application.",
  "needs-install":
    "Sur iPhone et iPad, ajoute d'abord BLOCUS à l'écran d'accueil : touche Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite l'application depuis son icône pour activer les notifications.",
  blocked:
    "Les notifications sont bloquées pour BLOCUS. Autorise-les dans les réglages de ton téléphone ou de ton navigateur, puis reviens ici.",
};

/**
 * Settings control for push notifications on this device. The permission prompt only appears after a tap (iOS
 * requires it), and only for a signed-in user: the subscription is saved on their account. Nothing is asked at
 * page load. `vapidPublicKey` is the public half of the server's VAPID key.
 */
export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [view, setView] = useState<View>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const support = detectPushSupport(window, process.env.NODE_ENV === "production");
      if (support !== "supported") return support;
      if (Notification.permission === "denied") return "blocked";

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || Notification.permission !== "granted") return "off";

      // The server may have lost it (expired, or another account used this device): save it again, once.
      if (!synced.current) {
        synced.current = true;
        void savePushSubscription(subscription.toJSON());
      }
      return "on";
    }
    detect()
      .then((next) => !cancelled && setView(next))
      .catch(() => !cancelled && setView("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      // First await of the tap: the permission prompt needs the user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setView(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const saved = await savePushSubscription(subscription.toJSON());
      if (!saved.ok) {
        await subscription.unsubscribe();
        setError(saved.message);
        return;
      }
      setView("on");
    } catch {
      setError("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const removed = await removePushSubscription(subscription.endpoint);
        if (!removed.ok) {
          setError(removed.message);
          return;
        }
        await subscription.unsubscribe();
      }
      setView("off");
    } catch {
      setError("Impossible de désactiver les notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (view === "checking") return <div className="card h-[4.5rem]" aria-hidden="true" />;

  if (view === "unsupported" || view === "needs-install" || view === "blocked") {
    return (
      <p className="card px-4 py-3 text-sm text-muted" role="note">
        {COPY[view]}
      </p>
    );
  }

  const on = view === "on";
  return (
    <div className="card flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Nouveaux posts</p>
          <p className="text-xs text-muted">
            {on
              ? "Activées sur cet appareil."
              : "Reçois une notification quand un post est publié."}
          </p>
        </div>
        <button
          type="button"
          onClick={on ? disable : enable}
          disabled={busy}
          aria-pressed={on}
          className={`btn btn-sm shrink-0 whitespace-nowrap ${on ? "btn-outline" : "btn-primary"}`}
        >
          {busy ? "…" : on ? "Désactiver" : "Activer"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-feedback-error">
          {error}
        </p>
      )}
    </div>
  );
}
