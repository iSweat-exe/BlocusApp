import { describe, expect, it } from "vitest";
import { computeHealthScore, DB_QUOTA_BYTES, statusOfScore } from "./score";

const healthy = {
  dbMs: 80,
  authMs: 120,
  dbSizeBytes: 20 * 1024 * 1024,
  vercelState: "READY",
  cronAgeHours: 10,
  connectionsRatio: 0.2,
  configShare: 1,
};

describe("computeHealthScore", () => {
  it("is 100 when everything is fast, small, recent and configured", () => {
    expect(computeHealthScore(healthy)).toBe(100);
  });

  it("drops by the database weight when the database does not answer", () => {
    expect(computeHealthScore({ ...healthy, dbMs: null })).toBe(70);
  });

  it("drops by the Auth weight when Auth does not answer", () => {
    expect(computeHealthScore({ ...healthy, authMs: null })).toBe(80);
  });

  it("lowers the score linearly between the good and bad latencies", () => {
    // 850 ms is halfway between 200 and 1500: half of the 30 points are lost.
    expect(computeHealthScore({ ...healthy, dbMs: 850 })).toBe(85);
  });

  it("penalizes a database close to the quota", () => {
    // 85 % of the quota is halfway between 70 % and 100 %: half of the 15 points are lost.
    expect(computeHealthScore({ ...healthy, dbSizeBytes: DB_QUOTA_BYTES * 0.85 })).toBe(93);
    expect(computeHealthScore({ ...healthy, dbSizeBytes: DB_QUOTA_BYTES })).toBe(85);
  });

  it("scores a failed deployment and an unknown state", () => {
    expect(computeHealthScore({ ...healthy, vercelState: "ERROR" })).toBe(90);
    expect(computeHealthScore({ ...healthy, vercelState: "WEIRD" })).toBe(95);
  });

  it("penalizes a daily cron that has not run for a while", () => {
    expect(computeHealthScore({ ...healthy, cronAgeHours: 36 })).toBe(100);
    expect(computeHealthScore({ ...healthy, cronAgeHours: 54 })).toBe(95);
    expect(computeHealthScore({ ...healthy, cronAgeHours: 100 })).toBe(90);
  });

  it("penalizes many open connections", () => {
    expect(computeHealthScore({ ...healthy, connectionsRatio: 0.6 })).toBe(100);
    expect(computeHealthScore({ ...healthy, connectionsRatio: 0.75 })).toBe(95);
    expect(computeHealthScore({ ...healthy, connectionsRatio: 0.95 })).toBe(90);
  });

  it("penalizes a missing configuration", () => {
    expect(computeHealthScore({ ...healthy, configShare: 0.5 })).toBe(98);
    expect(computeHealthScore({ ...healthy, configShare: 0 })).toBe(95);
  });

  it("leaves unknown measures out instead of counting them as failures", () => {
    expect(
      computeHealthScore({
        dbMs: 80,
        authMs: 120,
        dbSizeBytes: null,
        vercelState: null,
        cronAgeHours: null,
        connectionsRatio: null,
        configShare: null,
      }),
    ).toBe(100);
    expect(
      computeHealthScore({ dbMs: 80, authMs: 120, dbSizeBytes: null, vercelState: null }),
    ).toBe(100);
  });

  it("is 0 when nothing answers", () => {
    expect(
      computeHealthScore({ dbMs: null, authMs: null, dbSizeBytes: null, vercelState: null }),
    ).toBe(0);
  });
});

describe("statusOfScore", () => {
  it.each([
    [100, "ok"],
    [90, "ok"],
    [89, "degraded"],
    [60, "degraded"],
    [59, "down"],
    [0, "down"],
  ] as const)("%i is %s", (score, status) => {
    expect(statusOfScore(score)).toBe(status);
  });
});
