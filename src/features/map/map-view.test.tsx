import { act, render, screen, waitFor, within } from "@testing-library/react";
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
    sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
    layers: string[] = [];
    visibility = new Map<string, string>();
    centerAt = { lng: 2.5, lat: 48.5 };
    touchZoomRotate = { disableRotation: vi.fn() };
    dragPan = { enable: vi.fn(), disable: vi.fn() };
    setStyle = vi.fn();
    flyTo = vi.fn();
    queryRenderedFeatures = vi.fn(() => [] as unknown[]);
    constructor(public options: Record<string, unknown>) {
      maps.push(this);
    }
    // `on(name, handler)` or `on(name, layer, handler)`.
    on(name: string, a: string | Handler, b?: Handler) {
      this.handlers.set(
        typeof a === "string" ? `${name}:${a}` : name,
        (typeof a === "string" ? b : a) as Handler,
      );
    }
    off() {}
    isStyleLoaded() {
      return this.styleLoaded;
    }
    getZoom() {
      return this.zoom;
    }
    getCenter() {
      return this.centerAt;
    }
    getCanvas() {
      return { style: {} as Record<string, string> };
    }
    getSource(id: string) {
      return this.sources.get(id);
    }
    addSource(id: string) {
      this.sources.set(id, { setData: vi.fn() });
    }
    addLayer(layer: { id: string }) {
      this.layers.push(layer.id);
    }
    setLayoutProperty(id: string, _name: string, value: string) {
      this.visibility.set(id, value);
    }
    remove() {
      this.removed = true;
    }
    fire(name: string, event?: unknown) {
      this.handlers.get(name)?.(event);
    }
  }
  class FakeMarker {
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
    element: HTMLElement;
    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element ?? document.createElement("div");
      markers.push(this);
    }
    getElement() {
      return this.element;
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

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const saveMapRoute = vi.fn();
const declareMapPosition = vi.fn();
const removeMapPosition = vi.fn();
vi.mock("./actions", () => ({
  saveMapRoute: (...args: unknown[]) => saveMapRoute(...args),
  declareMapPosition: (...args: unknown[]) => declareMapPosition(...args),
  removeMapPosition: (...args: unknown[]) => removeMapPosition(...args),
}));
vi.mock("@/components/full-screen-dialog", () => ({
  FullScreenDialog: ({
    triggerLabel,
    children,
  }: {
    triggerLabel: string;
    children: React.ReactNode;
  }) => (
    <div>
      <button type="button">{triggerLabel}</button>
      {children}
    </div>
  ),
}));

import MapView from "./map-view";

const ROUTE = {
  id: "00000000-0000-0000-0000-00000000b001",
  points: [
    [2.3, 48.8],
    [2.4, 48.9],
  ] as [number, number][],
};
const BASE = { positions: [], canDeclarePosition: false, canRemovePosition: false };
const NO_ROUTE = { route: null, canEditRoute: false, ...BASE };

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
    const { unmount } = render(<MapView {...NO_ROUTE} />);
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
    render(<MapView {...NO_ROUTE} />);
    expect(maps[0]?.options.style).toBe(MAP_STYLES.dark);
    expect(screen.getByRole("region", { name: "Carte" }).parentElement?.className).toContain(
      "map-dark",
    );
  });

  it("shows a loading hint until the map is ready", () => {
    render(<MapView {...NO_ROUTE} />);
    expect(screen.getByText("Chargement de la carte…")).toBeInTheDocument();
    loaded();
    expect(screen.queryByText("Chargement de la carte…")).toBeNull();
  });

  it("tells the user when the device has no WebGL, without creating a map", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<MapView {...NO_ROUTE} />);
    expect(maps).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible d'afficher la carte");
  });

  it("tells the user when the style cannot be loaded", () => {
    render(<MapView {...NO_ROUTE} />);
    act(() => maps[0]?.fire("error"));
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible d'afficher la carte");
  });

  it("does not flag an error once the style is loaded (a missing tile is not fatal)", () => {
    render(<MapView {...NO_ROUTE} />);
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
    render(<MapView {...NO_ROUTE} />);
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
    render(<MapView {...NO_ROUTE} />);
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
    render(<MapView {...NO_ROUTE} />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Me localiser" }));
    expect(screen.getByRole("status")).toHaveTextContent("Autorise la localisation");
    expect(maps[0]?.flyTo).not.toHaveBeenCalled();
  });
});

const lastData = () => {
  const calls = maps[0]?.sources.get("route")?.setData.mock.calls;
  return calls?.at(-1)?.[0] as { features: { geometry: { type: string } }[] } | undefined;
};
const pointCount = () => lastData()?.features.filter((f) => f.geometry.type === "Point").length;

async function openEditor() {
  const user = userEvent.setup();
  render(<MapView route={ROUTE} canEditRoute {...BASE} />);
  act(() => maps[0]?.fire("style.load"));
  loaded();
  await user.click(screen.getByRole("button", { name: /Modifier le tracé/ }));
  return user;
}

describe("MapView route", () => {
  it("opens on the route and draws it once the style is loaded", () => {
    render(<MapView route={ROUTE} canEditRoute={false} {...BASE} />);
    expect(maps[0]?.options.bounds).toEqual([
      [2.3, 48.8],
      [2.4, 48.9],
    ]);
    act(() => maps[0]?.fire("style.load"));
    expect(maps[0]?.layers).toEqual(
      expect.arrayContaining([
        "route-casing",
        "route-line",
        "route-ends",
        "route-points",
        "route-hit",
      ]),
    );
    loaded();
    expect(pointCount()).toBe(2);
  });

  it("re-adds the route after the style changes (theme switch)", () => {
    render(<MapView route={ROUTE} canEditRoute={false} {...BASE} />);
    act(() => maps[0]?.fire("style.load"));
    const first = maps[0]?.layers.length;
    maps[0]?.sources.clear(); // what setStyle() does to the old style
    act(() => maps[0]?.fire("style.load"));
    expect(maps[0]?.layers.length).toBe((first ?? 0) * 2);
  });

  it("offers editing only to those who may edit, never to Guests", () => {
    const { unmount } = render(<MapView route={ROUTE} canEditRoute={false} {...BASE} />);
    loaded();
    expect(screen.queryByRole("button", { name: /Modifier le tracé/ })).toBeNull();
    unmount();
    maps.length = 0;
    render(<MapView route={ROUTE} canEditRoute {...BASE} />);
    loaded();
    expect(screen.getByRole("button", { name: /Modifier le tracé/ })).toBeInTheDocument();
  });

  it("says when there is no route yet", () => {
    render(<MapView route={null} canEditRoute {...BASE} />);
    loaded();
    expect(screen.getByText("Pas encore de tracé")).toBeInTheDocument();
  });
});

describe("MapView route editing", () => {
  it("adds a point at the centre of the map, undoes it, and keeps Save for real changes", async () => {
    const user = await openEditor();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Ajouter ici" }));
    expect(screen.getByText("3 points")).toBeInTheDocument();
    expect(pointCount()).toBe(3);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByText("2 points")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Rétablir" }));
    expect(screen.getByText("3 points")).toBeInTheDocument();
  });

  it("saves the points with the version the edit started from, then leaves edit mode", async () => {
    saveMapRoute.mockResolvedValue({ status: "success", versionId: "v2" });
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Ajouter ici" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(saveMapRoute).toHaveBeenCalledWith(
      [
        [2.3, 48.8],
        [2.4, 48.9],
        [2.5, 48.5],
      ],
      ROUTE.id,
    );
    expect(await screen.findByRole("button", { name: /Modifier le tracé/ })).toBeInTheDocument();
  });

  it("explains a refused save and offers to reload when somebody else saved first", async () => {
    saveMapRoute.mockResolvedValue({
      status: "error",
      code: "stale",
      message: "Le tracé a été modifié par quelqu'un d'autre.",
    });
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Ajouter ici" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("modifié par quelqu'un d'autre");
    await user.click(screen.getByRole("button", { name: "Recharger le tracé" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });

  it("asks before dropping unsaved changes, but closes at once when nothing changed", async () => {
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Fermer l'édition" }));
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Modifier le tracé/ }));
    await user.click(screen.getByRole("button", { name: "Ajouter ici" }));
    await user.click(screen.getByRole("button", { name: "Fermer l'édition" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuer à modifier" }));
    expect(screen.getByRole("button", { name: "Ajouter ici" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fermer l'édition" }));
    await user.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(screen.getByRole("button", { name: /Modifier le tracé/ })).toBeInTheDocument();
    // The next edit starts from the saved route again.
    await user.click(screen.getByRole("button", { name: /Modifier le tracé/ }));
    expect(screen.getByText("2 points")).toBeInTheDocument();
  });

  it("drags a vertex: the map does not pan, one undo step, and the cursor is released", async () => {
    const user = await openEditor();
    const map = maps[0];
    act(() =>
      map?.fire("mousedown:route-hit", {
        features: [{ properties: { index: 1 } }],
        preventDefault: vi.fn(),
      }),
    );
    expect(map?.dragPan.disable).toHaveBeenCalled();
    act(() => map?.fire("mousemove", { lngLat: { lng: 2.45, lat: 48.95 } }));
    act(() => map?.fire("mouseup"));
    expect(map?.dragPan.enable).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("moves the selected vertex to the centre and deletes it", async () => {
    const user = await openEditor();
    act(() =>
      maps[0]?.fire("mousedown:route-hit", {
        features: [{ properties: { index: 0 } }],
        preventDefault: vi.fn(),
      }),
    );
    act(() => maps[0]?.fire("mouseup"));
    expect(screen.getByRole("button", { name: "Déplacer ici" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Déplacer ici" }));
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Supprimer le point" }));
    expect(screen.getByText("1 point")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled(); // one point is not a route
  });

  it("deselects when the empty map is tapped", async () => {
    await openEditor();
    act(() =>
      maps[0]?.fire("mousedown:route-hit", {
        features: [{ properties: { index: 0 } }],
        preventDefault: vi.fn(),
      }),
    );
    act(() => maps[0]?.fire("mouseup"));
    expect(screen.getByRole("button", { name: "Déplacer ici" })).toBeInTheDocument();
    act(() => maps[0]?.fire("click", { point: { x: 1, y: 1 } }));
    expect(screen.queryByRole("button", { name: "Déplacer ici" })).toBeNull();
  });
});

const NOW = Date.parse("2026-10-08T12:00:00Z");
const POSITIONS = [
  {
    id: "p2",
    lng: 2.35,
    lat: 48.86,
    label: "Place de la République",
    declaredAt: "2026-10-08T11:55:00Z",
    removedAt: null,
  },
  {
    id: "p1",
    lng: 2.3,
    lat: 48.85,
    label: "",
    declaredAt: "2026-10-08T10:00:00Z",
    removedAt: null,
  },
];
const positionProps = (over: Partial<React.ComponentProps<typeof MapView>> = {}) => ({
  route: null,
  canEditRoute: false,
  positions: POSITIONS,
  canDeclarePosition: false,
  canRemovePosition: false,
  ...over,
});
/** The marker of the declared position (the "me" dot is a marker too). */
const positionMarker = () => markers.find((m) => m.element.className === "map-position-marker");

describe("MapView position", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("shows a visible marker for the declared position, with an accessible name", () => {
    render(<MapView {...positionProps()} />);
    loaded();
    expect(positionMarker()).toBeDefined();
    expect(positionMarker()?.setLngLat).toHaveBeenCalledWith([2.35, 48.86]);
    expect(positionMarker()?.element.getAttribute("aria-label")).toContain(
      "Place de la République",
    );
  });

  it("opens on the position when there is no route, so it is visible at once", () => {
    render(<MapView {...positionProps()} />);
    expect(maps[0]?.options.bounds).toEqual([
      [2.35, 48.86],
      [2.35, 48.86],
    ]);
  });

  it("shows the information to everybody when the marker is tapped", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps()} />);
    loaded();
    await user.click(positionMarker()!.element);
    const card = screen.getByRole("region", { name: "Position de la manifestation" });
    expect(card).toHaveTextContent("Place de la République");
    expect(card).toHaveTextContent("Déclarée il y a 5 min");
    expect(card).toHaveTextContent("48.86000, 2.35000");
    expect(within(card).getByRole("link", { name: "Voir le plan" })).toHaveAttribute(
      "href",
      expect.stringContaining("mlat=48.86&mlon=2.35"),
    );
    // Guests and ordinary users cannot remove it.
    expect(within(card).queryByRole("button", { name: "Retirer la position" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Fermer les informations" }));
    expect(screen.queryByRole("region", { name: "Position de la manifestation" })).toBeNull();
  });

  it("lists the history, flagging the removed declarations", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const positions = [POSITIONS[0]!, { ...POSITIONS[1]!, removedAt: "2026-10-08T10:30:00Z" }];
    render(<MapView {...positionProps({ positions })} />);
    loaded();
    await user.click(positionMarker()!.element);
    expect(screen.getByText("Actuelle")).toBeInTheDocument();
    expect(screen.getByText("Retirée")).toBeInTheDocument();
  });

  it("shows no marker when no position was declared, or when the newest one was removed", () => {
    const { unmount } = render(<MapView {...positionProps({ positions: [] })} />);
    loaded();
    expect(positionMarker()).toBeUndefined();
    unmount();
    maps.length = 0;
    markers.length = 0;
    // The newest was removed: the older one must NOT come back.
    const removedNewest = [{ ...POSITIONS[0]!, removedAt: "2026-10-08T11:58:00Z" }, POSITIONS[1]!];
    render(<MapView {...positionProps({ positions: removedNewest })} />);
    loaded();
    expect(positionMarker()).toBeUndefined();
  });

  it("lets the author remove the position after a confirmation, then closes the card", async () => {
    removeMapPosition.mockResolvedValue({ status: "success" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ canRemovePosition: true })} />);
    loaded();
    await user.click(positionMarker()!.element);
    await user.click(screen.getByRole("button", { name: "Retirer la position" }));
    // Nothing is removed before the confirmation.
    expect(removeMapPosition).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("ne sera plus affichée");
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(removeMapPosition).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Retirer la position" }));
    await user.click(screen.getByRole("button", { name: "Retirer" }));
    expect(removeMapPosition).toHaveBeenCalledWith("p2");
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Position de la manifestation" })).toBeNull(),
    );
  });

  it("shows why a removal was refused and keeps the card open", async () => {
    removeMapPosition.mockResolvedValue({
      status: "error",
      code: "forbidden",
      message: "Seule la personne qui a déclaré cette position peut la retirer.",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ canRemovePosition: true })} />);
    loaded();
    await user.click(positionMarker()!.element);
    await user.click(screen.getByRole("button", { name: "Retirer la position" }));
    await user.click(screen.getByRole("button", { name: "Retirer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seule la personne");
    expect(
      screen.getByRole("region", { name: "Position de la manifestation" }),
    ).toBeInTheDocument();
  });

  it("offers the declaration only to those who may, never to Guests", () => {
    const { unmount } = render(<MapView {...NO_ROUTE} />);
    loaded();
    expect(screen.queryByRole("button", { name: "Déclarer la position" })).toBeNull();
    unmount();
    maps.length = 0;
    render(<MapView {...positionProps({ positions: [], canDeclarePosition: true })} />);
    loaded();
    expect(screen.getByRole("button", { name: "Déclarer la position" })).toBeInTheDocument();
  });

  it("ignores taps on the marker while a declaration is in progress", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ canDeclarePosition: true })} />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Déclarer la position" }));
    await user.click(positionMarker()!.element);
    expect(screen.queryByRole("region", { name: "Position de la manifestation" })).toBeNull();
  });

  it("declares at the centre of the map with the label, then goes back to the map", async () => {
    declareMapPosition.mockResolvedValue({ status: "success" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ positions: [], canDeclarePosition: true })} />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Déclarer la position" }));
    await user.type(screen.getByLabelText(/Lieu/), "Gare de l'Est");
    await user.click(screen.getByRole("button", { name: "Déclarer ici" }));
    expect(declareMapPosition).toHaveBeenCalledWith(2.5, 48.5, "Gare de l'Est");
    expect(await screen.findByRole("button", { name: "Déclarer la position" })).toBeInTheDocument();
  });

  it("shows why a declaration was refused and stays in the declaration mode", async () => {
    declareMapPosition.mockResolvedValue({
      status: "error",
      code: "rate_limited",
      message: "Patiente quelques secondes avant de déclarer une nouvelle position.",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ positions: [], canDeclarePosition: true })} />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Déclarer la position" }));
    await user.click(screen.getByRole("button", { name: "Déclarer ici" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Patiente quelques secondes");
    expect(screen.getByRole("button", { name: "Déclarer ici" })).toBeInTheDocument();
  });

  it("the GPS shortcut only moves the map: nothing is declared until the manager confirms", async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((ok: (p: unknown) => void) =>
        ok({ coords: { longitude: 2.4, latitude: 48.9 } }),
      ),
    };
    Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ positions: [], canDeclarePosition: true })} />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Déclarer la position" }));
    await user.click(screen.getByRole("button", { name: "Ma position" }));
    expect(maps[0]?.flyTo).toHaveBeenCalledWith({ center: [2.4, 48.9], zoom: 15 });
    expect(declareMapPosition).not.toHaveBeenCalled();
  });

  it("closes the declaration without sending anything", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MapView {...positionProps({ positions: [], canDeclarePosition: true })} />);
    loaded();
    await user.click(screen.getByRole("button", { name: "Déclarer la position" }));
    await user.click(screen.getByRole("button", { name: "Fermer la déclaration" }));
    expect(screen.getByRole("button", { name: "Déclarer la position" })).toBeInTheDocument();
    expect(declareMapPosition).not.toHaveBeenCalled();
  });
});
