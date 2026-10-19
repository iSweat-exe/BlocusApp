import { describe, expect, it } from "vitest";
import { agoLabel, lastSeenStatus } from "./last-seen";

const now = new Date("2026-10-16T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("lastSeenStatus", () => {
  it("is online when seen in the last 10 minutes", () => {
    expect(lastSeenStatus(ago(0), now)).toEqual({ state: "online" });
    expect(lastSeenStatus(ago(9 * MIN), now)).toEqual({ state: "online" });
  });

  it("treats a date a little in the future as just now", () => {
    expect(lastSeenStatus(ago(-2 * MIN), now)).toEqual({ state: "online" });
  });

  it("is offline from 10 minutes on, with how long ago", () => {
    expect(lastSeenStatus(ago(10 * MIN), now)).toEqual({
      state: "offline",
      agoLabel: "il y a 10 minutes",
    });
    expect(lastSeenStatus(ago(3 * HOUR), now)).toEqual({
      state: "offline",
      agoLabel: "il y a 3 heures",
    });
  });

  it("is unknown without a date or with an unreadable one", () => {
    expect(lastSeenStatus(null, now)).toEqual({ state: "unknown" });
    expect(lastSeenStatus("not a date", now)).toEqual({ state: "unknown" });
  });
});

describe("agoLabel", () => {
  it.each([
    [MIN, "il y a 1 minute"],
    [59 * MIN, "il y a 59 minutes"],
    [HOUR, "il y a 1 heure"],
    [23 * HOUR, "il y a 23 heures"],
    [DAY, "il y a 1 jour"],
    [29 * DAY, "il y a 29 jours"],
    [30 * DAY, "il y a 1 mois"],
    [364 * DAY, "il y a 12 mois"],
    [400 * DAY, "il y a 1 an"],
  ])("%d ms → %s", (elapsed, label) => {
    expect(agoLabel(elapsed)).toBe(label);
  });
});
