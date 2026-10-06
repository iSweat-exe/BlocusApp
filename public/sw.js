// Minimal service worker: makes the app installable and takes control right away.
// TODO: offline cache strategy and Web Push handlers (see .dev/checklist-v1.0.0-application.md, step 1.10).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
