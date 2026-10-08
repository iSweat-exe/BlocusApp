import { describe, expect, it } from "vitest";
import { computeHealthScore, DB_QUOTA_BYTES, statusOfScore } from "./score";

const healthy = { dbMs: 80, authMs: 120, dbSizeBytes: 20 * 1024 * 1024, vercelState: "READY" };

describe("computeHealthScore", () => {
  it("is 100 when everything is fast, small and deployed", () => {
    expect(computeHealthScore(healthy)).toBe(100);
  });

  it("drops to 60 when the database does not answer", () => {
    expect(computeHealthScore({ ...healthy, dbMs: null })).toBe(60);
  });

  it("drops by the Auth weight when Auth does not answer", () => {
    expect(computeHealthScore({ ...healthy, authMs: null })).toBe(75);
  });

  it("lowers the score linearly between the good and bad latencies", () => {
    // 850 ms is halfway between 200 and 1500: half of the 40 points are lost.
    expect(computeHealthScore({ ...healthy, dbMs: 850 })).toBe(80);
  });

  it("penalizes a database close to the quota", () => {
    // 85 % of the quota is halfway between 70 % and 100 %: half of the 20 points are lost.
    expect(computeHealthScore({ ...healthy, dbSizeBytes: DB_QUOTA_BYTES * 0.85 })).toBe(90);
    expect(computeHealthScore({ ...healthy, dbSizeBytes: DB_QUOTA_BYTES })).toBe(80);
  });

  it("scores a failed deployment and an unknown state", () => {
    expect(computeHealthScore({ ...healthy, vercelState: "ERROR" })).toBe(85);
    expect(computeHealthScore({ ...healthy, vercelState: "WEIRD" })).toBe(93);
  });

  it("leaves unknown measures out instead of counting them as failures", () => {
    expect(computeHealthScore({ ...healthy, vercelState: null, dbSizeBytes: null })).toBe(100);
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
