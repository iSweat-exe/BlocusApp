/**
 * Cache tags of the public data shared by every visitor (see the `'use cache'` readers in this folder). Writes
 * expire their own tag with `updateTag`; the manual "Actualiser" button expires all of them.
 */
export const PUBLIC_DATA_TAGS = ["announcements", "events", "map-route", "map-positions"] as const;
