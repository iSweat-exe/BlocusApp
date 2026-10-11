import { describe, expect, it } from "vitest";
import {
  availabilityTone,
  configTone,
  connectionsTone,
  cronTone,
  latencyTone,
  lowerIsBetter,
  storageTone,
  vercelTone,
} from "./health-tones";
import { DB_QUOTA_BYTES, THRESHOLDS } from "./score";

describe("lowerIsBetter", () => {
  it("is fine up to the good limit, critical from the bad one, to watch in between", () => {
    const range = { good: 200, bad: 1500 };
    expect(lowerIsBetter(0, range)).toBe("ok");
    expect(lowerIsBetter(200, range)).toBe("ok");
    expect(lowerIsBetter(201, range)).toBe("degraded");
    expect(lowerIsBetter(1499, range)).toBe("degraded");
    expect(lowerIsBetter(1500, range)).toBe("down");
  });
});

describe("latencyTone", () => {
  it("reads the same limits as the score, and calls a silent service critical", () => {
    expect(latencyTone(85, THRESHOLDS.dbMs)).toBe("ok");
    expect(latencyTone(900, THRESHOLDS.dbMs)).toBe("degraded");
    expect(latencyTone(2000, THRESHOLDS.authMs)).toBe("down");
    expect(latencyTone(null, THRESHOLDS.dbMs)).toBe("down");
  });
});

describe("storageTone", () => {
  it("watches from 70 % of the quota and is critical at 100 %", () => {
    expect(storageTone(0.5 * DB_QUOTA_BYTES)).toBe("ok");
    expect(storageTone(0.8 * DB_QUOTA_BYTES)).toBe("degraded");
    expect(storageTone(DB_QUOTA_BYTES)).toBe("down");
    expect(storageTone(null)).toBe("neutral");
  });
});

describe("connectionsTone", () => {
  it("watches from 60 % of the limit and is critical from 90 %", () => {
    expect(connectionsTone({ open: 12, max: 60 })).toBe("ok");
    expect(connectionsTone({ open: 42, max: 60 })).toBe("degraded");
    expect(connectionsTone({ open: 55, max: 60 })).toBe("down");
  });

  it("is neutral when it is unknown or the limit is not usable", () => {
    expect(connectionsTone(null)).toBe("neutral");
    expect(connectionsTone({ open: 1, max: 0 })).toBe("neutral");
  });
});

describe("cronTone", () => {
  it("is fine for 36 hours, then to watch, critical from 72 hours; never ran is to watch", () => {
    expect(cronTone(12)).toBe("ok");
    expect(cronTone(50)).toBe("degraded");
    expect(cronTone(80)).toBe("down");
    expect(cronTone(null)).toBe("degraded");
  });
});

describe("vercelTone", () => {
  it("is neutral when not configured and to watch when the API does not answer", () => {
    expect(vercelTone({ kind: "not_configured" })).toBe("neutral");
    expect(vercelTone({ kind: "unavailable" })).toBe("degraded");
  });

  it("follows the deployment state", () => {
    expect(vercelTone({ kind: "ok", state: "READY", createdAt: null })).toBe("ok");
    expect(vercelTone({ kind: "ok", state: "BUILDING", createdAt: null })).toBe("degraded");
    expect(vercelTone({ kind: "ok", state: "SOMETHING_NEW", createdAt: null })).toBe("degraded");
    expect(vercelTone({ kind: "ok", state: "ERROR", createdAt: null })).toBe("down");
  });
});

describe("availabilityTone", () => {
  it("is fine from 99 %, to watch from 95 %, critical below, neutral without data", () => {
    expect(availabilityTone(99.9)).toBe("ok");
    expect(availabilityTone(97.5)).toBe("degraded");
    expect(availabilityTone(80)).toBe("down");
    expect(availabilityTone(null)).toBe("neutral");
  });
});

describe("configTone", () => {
  it("is critical for a missing required variable and only to watch for an optional one", () => {
    expect(configTone({ ok: true, required: true })).toBe("ok");
    expect(configTone({ ok: false, required: true })).toBe("down");
    expect(configTone({ ok: false, required: false })).toBe("degraded");
  });
});
