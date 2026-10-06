import { describe, expect, it } from "vitest";
import { err, ok } from "./result";

describe("result", () => {
  it("wraps a value in a successful result", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("builds an error without a message", () => {
    expect(err("not_found")).toEqual({ ok: false, error: "not_found" });
  });

  it("builds an error with a message", () => {
    expect(err("forbidden", "missing permission")).toEqual({
      ok: false,
      error: "forbidden",
      message: "missing permission",
    });
  });
});
