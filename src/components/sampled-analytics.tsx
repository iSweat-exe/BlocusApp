"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";

/**
 * Share of browsers whose page views are sent to Vercel Web Analytics. The Hobby plan includes 50 000 events
 * a month and every event is also an edge request: at ~600 000 page views a month, counting everybody would
 * stop the collection after about two days. 5 % of the browsers is ~30 000 events, which is plenty to see
 * trends. Raise it if the real traffic turns out to be lower.
 */
export const ANALYTICS_SAMPLE_RATE = 0.05;

const STORAGE_KEY = "blocus.analytics";

/**
 * Whether this browser is part of the sample. The draw is made once and remembered, so a visitor is either
 * followed on every visit or never (per-event sampling would split one visit into pieces and distort the
 * visitor counts). Without storage the draw is simply remade on each load.
 */
export function isSampled(random: () => number = Math.random): boolean {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
    const sampled = random() < ANALYTICS_SAMPLE_RATE;
    window.localStorage.setItem(STORAGE_KEY, sampled ? "1" : "0");
    return sampled;
  } catch {
    return random() < ANALYTICS_SAMPLE_RATE;
  }
}

// Computed lazily, on the first event: `window` does not exist while the server renders.
let sampled: boolean | undefined;
const beforeSend: BeforeSend = (event) => {
  sampled ??= isSampled();
  return sampled ? event : null;
};

/** Vercel Web Analytics for a sample of the browsers (see {@link ANALYTICS_SAMPLE_RATE}). */
export function SampledAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
