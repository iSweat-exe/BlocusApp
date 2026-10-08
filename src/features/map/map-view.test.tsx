import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAP_STYLES } from "./map-config";

type Handler = (event?: unknown) => void;

// vi.mock is hoisted above the imports: the fakes it uses must be created in a hoisted block too.
const { maps, markers, FakeMap, FakeMarker } = vi.hoisted(() => {
  const maps: InstanceType<typeof FakeMap>[] = [];
  const markers: InstanceType<typeof FakeMarker>[] = [];

  class FakeMap {
    handlers = new Map<string, Handler>();
    styleLoaded = false;
    removed = false;
    zoom = 5;
    touchZoomRotate = { disableRotation: vi.fn() };
    setStyle = vi.fn();
    flyTo = vi.fn();
    constructor(public options: Record<string, unknown>) {
      maps.push(this);
    }
    on(name: string, handler: Handler) {
      this.handlers.set(name, handler);
    }
    isStyleLoaded() {
      return this.styleLoaded;
    }
    getZoom() {
      return this.zoom;
    }
    remove() {
      this.removed = true;
    }
    fire(name: string) {
      this.handlers.get(name)?.();
    }
  }
  class FakeMarker {
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
    constructor() {
      markers.push(this);
    }
  }
  return { maps, markers, FakeMap, FakeMarker };
});

vi.mock("maplibre-gl", () => ({
  Map: FakeMap,
  Marker: FakeMarker,
  setWorkerUrl: vi.fn(),
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import MapView from "./map-view";

function mockSystemTheme(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query.includes("dark"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  maps.length = 0;
  markers.length = 0;
  mockSystemTheme(false);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

const loaded = () => act(() => maps[0]?.fire("load"));

describe("MapView", () => {
  it("creates the map with the light style and a folded attribution, and cleans up", () => {
    const { unmount } = render(<MapView />);
    expect(maps).toHaveLength(1);
    expect(maps[0]?.options).toMatchObject({
      style: MAP_STYLES.light,
      attributionControl: { compact: true },
      pitchWithRotate: false,
    });
    expect(maps[0]?.touchZoomRotate.disableRotation).toHaveBeenCalled();
    unmount();
    expect(maps[0]?.removed).toBe(true);
  });

  it("starts with the dark basemap, inverted, when the app is dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<MapView />);
    expect(maps[0]?.options.style).toBe(MAP_STYLES.dark);
    expect(screen.getByRole("region", { name: "Carte" }).parentElement?.className).toContain(
      "map-dark",
    );
  });

  it("shows a loading hint until the map is ready", () => {
    render(<MapView />);
    expect(screen.getByText("Chargement de la carte…")).toBeInTheDocument();
    loaded();
    expect(screen.queryByText("Chargement de la carte…")).toBeNull();
  });

  it("tells the user when the device has no WebGL, without creating a map", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<MapView />);
    expect(maps).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible d'afficher la carte");
  });

  it("tells the user when the style cannot be loaded", () => {
    render(<MapView />);
    act(() => maps[0]?.fire("error"));
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible d'afficher la carte");
  });

  it("does not flag an error once the style is loaded (a missing tile is not fatal)", () => {
    render(<MapView />);
    if (maps[0]) maps[0].styleLoaded = true;
    act(() => maps[0]?.fire("error"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("MapView locate button", () => {
  const geolocation = { getCurrentPosition: vi.fn() };
  beforeEach(() => {
    geolocation.getCurrentPosition.mockReset();
    Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
  });

  it("is disabled until the map is ready", () => {
    render(<MapView />);
    expect(screen.getByRole("button", { name: "Me localiser" })).toBeDisabled();
    loaded();
    expect(screen.getByRole("button", { name: "Me localiser" })).toBeEnabled();
  });

  it("shows the user on the device only: a marker and a fly-to, nothing sent anywhere", async () => {
    const user = userEvent.setup();
    geolocation.getCurrentPosition.mockImplementation((ok: (p: unknown) => void) =>
      ok({ coords: { longitude: 2.3, latitude: 48.8 } }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<MapView />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Me localiser" }));
    expect(markers[0]?.setLngLat).toHaveBeenCalledWith([2.3, 48.8]);
    expect(maps[0]?.flyTo).toHaveBeenCalledWith({ center: [2.3, 48.8], zoom: 15 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains how to continue when the permission is denied", async () => {
    const user = userEvent.setup();
    geolocation.getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: unknown) => void) =>
      fail({ code: 1, PERMISSION_DENIED: 1 }),
    );
    render(<MapView />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Me localiser" }));
    expect(screen.getByRole("status")).toHaveTextContent("Autorise la localisation");
    expect(maps[0]?.flyTo).not.toHaveBeenCalled();
  });
});
