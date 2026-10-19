/** Whether this device can receive notifications from the web app, and if not, what the person can do. */
export type PushSupport =
  /** Everything needed is there. */
  | "supported"
  /** iPhone / iPad in Safari: the app must be added to the Home Screen first (iOS only offers push to installed apps). */
  | "needs-install"
  /** The browser has no Web Push (or this is a development build, where the service worker is off). */
  | "unsupported";

type DeviceWindow = {
  navigator: Pick<Navigator, "userAgent" | "maxTouchPoints"> & { standalone?: boolean };
  matchMedia: (query: string) => { matches: boolean };
};

/** Converts the VAPID public key (base64url) to the bytes `PushManager.subscribe()` expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Detects the push support of the current device. iPadOS reports itself as a Mac, hence the touch check. The
 * service worker is only registered in production builds, so a development build never supports push.
 * @param win - The `window` (injected for tests).
 * @param production - Whether this is a production build.
 */
export function detectPushSupport(win: DeviceWindow, production: boolean): PushSupport {
  const { userAgent, maxTouchPoints, standalone } = win.navigator;
  const ios =
    /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const installed = standalone === true || win.matchMedia("(display-mode: standalone)").matches;
  const capable = "serviceWorker" in win.navigator && "PushManager" in win && "Notification" in win;

  if (ios && !installed) return "needs-install";
  return production && capable ? "supported" : "unsupported";
}
