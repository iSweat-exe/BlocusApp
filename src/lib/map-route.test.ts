import { describe, expect, it } from "vitest";
import {
  MAX_ROUTE_POINTS,
  parseRoutePoints,
  routeBounds,
  routeToGeoJSON,
  samePoints,
} from "./map-route";

describe("parseRoutePoints", () => {
  it("accepts an empty route and 2+ valid points, rounded to 6 decimals", () => {
    expect(parseRoutePoints([])).toEqual([]);
    expect(
      parseRoutePoints([
        [2.123456789, 48.1],
        [2.3, 48.2],
      ]),
    ).toEqual([
      [2.123457, 48.1],
      [2.3, 48.2],
    ]);
  });

  it("refuses everything else, as the database does", () => {
    const bad: unknown[] = [
      null,
      "x",
      {},
      [[2, 48]], // a single point
      [[2, 48], [3]],
      [
        [2, 48],
        ["3", 4],
      ],
      [
        [2, 48],
        [181, 4],
      ],
      [
        [2, 48],
        [3, 91],
      ],
      [
        [2, 48],
        [Number.NaN, 4],
      ],
      Array.from({ length: MAX_ROUTE_POINTS + 1 }, () => [1, 1]),
    ];
    for (const value of bad) expect(parseRoutePoints(value)).toBeNull();
    expect(parseRoutePoints(Array.from({ length: MAX_ROUTE_POINTS }, () => [1, 1]))).not.toBeNull();
  });
});

describe("routeBounds and samePoints", () => {
  it("computes the bounding box", () => {
    expect(
      routeBounds([
        [2, 48],
        [3, 47],
        [2.5, 49],
      ]),
    ).toEqual([
      [2, 47],
      [3, 49],
    ]);
    expect(routeBounds([])).toBeNull();
  });

  it("compares routes point by point", () => {
    expect(samePoints([[1, 2]], [[1, 2]])).toBe(true);
    expect(samePoints([[1, 2]], [[1, 3]])).toBe(false);
    expect(samePoints([[1, 2]], [])).toBe(false);
  });
});

describe("routeToGeoJSON", () => {
  it("has a line only from two points, and flags start, end and selection", () => {
    expect(routeToGeoJSON([]).features).toHaveLength(0);
    expect(routeToGeoJSON([[1, 1]]).features.map((f) => f.geometry.type)).toEqual(["Point"]);

    const collection = routeToGeoJSON(
      [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
      1,
    );
    expect(collection.features.map((f) => f.geometry.type)).toEqual([
      "LineString",
      "Point",
      "Point",
      "Point",
    ]);
    const roles = collection.features.flatMap((f) =>
      f.geometry.type === "Point" && "role" in f.properties
        ? [[f.properties.role, f.properties.selected]]
        : [],
    );
    expect(roles).toEqual([
      ["start", false],
      ["vertex", true],
      ["end", false],
    ]);
  });
});
