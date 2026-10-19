import { isInstalledApp, isIosDevice, type DeviceWindow } from "@/features/push/device";

/**
 * How this device can get the app on its Home Screen:
 * - `installed`: already running as an installed app, nothing to do;
 * - `prompt`: the browser offered a native install prompt (Chrome and Edge on Android and desktop);
 * - `ios`: Safari on iPhone / iPad, no prompt exists, the person must use Share > Add to Home Screen;
 * - `unavailable`: no way we can help with (another browser, or the prompt never came).
 */
export type InstallMode = "installed" | "prompt" | "ios" | "unavailable";

/** The non-standard event Chromium fires when the app can be installed. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;

/**
 * Decides the install mode.
 * @param win - The `window` (injected for tests).
 * @param hasPrompt - Whether a native install prompt is waiting.
 */
export function detectInstallMode(win: DeviceWindow, hasPrompt: boolean): InstallMode {
  if (isInstalledApp(win)) return "installed";
  if (isIosDevice(win.navigator)) return "ios";
  return hasPrompt ? "prompt" : "unavailable";
}

/** Current install mode of this device (browser only). */
export function readInstallMode(): InstallMode {
  return detectInstallMode(window, deferred !== null);
}

/** Server snapshot for `useSyncExternalStore`: nothing is known on the server. */
export const readServerInstallMode = (): InstallMode => "unavailable";

/** Keeps the native install prompt for later (the browser would show its own banner at a random time). */
export function subscribeToInstall(onChange: () => void): () => void {
  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    onChange();
  };
  const onInstalled = () => {
    deferred = null;
    onChange();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Shows the native install prompt. @returns Whether the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null; // a prompt can only be used once
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}
