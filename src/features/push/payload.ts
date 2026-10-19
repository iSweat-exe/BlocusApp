/** What a notification shows and where a tap leads. */
export type PushMessage = {
  title: string;
  body: string;
  /** Absolute URL on this site, opened when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
};

/** Push services reject a message above ~4 KB once encrypted; the text is cut well below that. */
const TITLE_MAX = 60;
const BODY_MAX = 140;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * Builds the JSON body of a push message. It follows the Declarative Web Push format (Safari 18.4+ shows it even
 * without a running service worker; `web_push: 8030` is the marker). Other browsers, and older Safari, hand the
 * same JSON to the service worker, which reads `notification` the same way (`public/sw.js`).
 */
export function buildPushPayload(message: PushMessage): string {
  return JSON.stringify({
    web_push: 8030,
    notification: {
      title: truncate(message.title, TITLE_MAX),
      body: truncate(message.body, BODY_MAX),
      navigate: message.url,
      tag: message.tag,
    },
  });
}
