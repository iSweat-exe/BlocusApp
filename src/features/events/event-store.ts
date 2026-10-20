import { EVENT_STORAGE_KEY, type EventKey } from "./event";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

/** The event applied to the page right now (the boot script sets it before first paint), or `null`. */
export function readActiveEvent(): EventKey | null {
  return document.documentElement.getAttribute("data-event") === "halloween" ? "halloween" : null;
}

/** Server snapshot for `useSyncExternalStore`: the server knows no event. */
export const readServerActiveEvent = (): EventKey | null => null;

/** Whether the person switched the event off on this device (the toggle must stay reachable then). */
export function readEventSwitchedOff(): boolean {
  return storage()?.getItem(EVENT_STORAGE_KEY) === "off";
}

/** Server snapshot: nothing is switched off as far as the server knows. */
export const readServerEventSwitchedOff = (): boolean => false;

/** Subscribes to the event being applied or removed, from any code that sets `data-event` or the preview. */
export function subscribeToEvent(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-event"] });
  const onStorage = (event: StorageEvent) => {
    if (event.key === EVENT_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

/** Switches the event on or off on this device and applies it at once (no reload). */
export function setEventEnabled(key: EventKey, enabled: boolean): void {
  try {
    storage()?.setItem(EVENT_STORAGE_KEY, enabled ? key : "off");
  } catch {
    // Quota or blocked storage: the change still applies for this page view.
  }
  const root = document.documentElement;
  if (enabled) root.setAttribute("data-event", key);
  else root.removeAttribute("data-event");
}
