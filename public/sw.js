// Service worker: makes the app installable, takes control right away and shows Web Push notifications.
// TODO: offline cache strategy (see .dev/checklist-v1.0.0-application.md, A-132).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ICON = "/icons/icon-192.png";

/**
 * Reads a push message. Two shapes are understood: the Declarative Web Push one the server sends
 * (`{ web_push: 8030, notification: { title, body, navigate, tag } }`) and a plain `{ title, body, url, tag }`.
 * Always returns something to show: Safari revokes the permission of a site that receives a push and shows nothing.
 */
function readMessage(event) {
  const fallback = { title: "BLOCUS", body: "Du nouveau sur BLOCUS.", url: "/", tag: "blocus" };
  if (!event.data) return fallback;
  try {
    const data = event.data.json();
    const source = data && typeof data.notification === "object" && data.notification ? data.notification : data;
    const text = (value, max) => (typeof value === "string" && value ? value.slice(0, max) : undefined);
    return {
      title: text(source.title, 100) ?? fallback.title,
      body: text(source.body, 300) ?? fallback.body,
      url: text(source.navigate ?? source.url, 2048) ?? fallback.url,
      tag: text(source.tag, 100) ?? fallback.tag,
    };
  } catch {
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  const message = readMessage(event);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: ICON,
      tag: message.tag,
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only this site can be opened: the URL comes from a push message.
  let target = new URL("/", self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url ?? "/", self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {
    // Keep the home page.
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        // `navigate` is missing on some platforms: the app is then simply brought to the front.
        if ("navigate" in open) await open.navigate(target.href).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
