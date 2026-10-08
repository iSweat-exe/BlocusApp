import type { Map as MapLibreMap, MapLayerMouseEvent, MapLayerTouchEvent } from "maplibre-gl";
import { useEffect, type Dispatch } from "react";
import type { LngLat } from "@/lib/map-route";
import type { EditorAction } from "./route-editor-state";
import { ROUTE_LAYERS } from "./route-layers";

/**
 * Finger and mouse editing of the route on the map while `enabled`: tap a vertex to select it, drag it to move
 * it (the map does not pan during the drag), tap the empty map to deselect. A whole drag is one undo step
 * (see the editor reducer).
 */
export function useRouteEditing(
  map: MapLibreMap | null,
  enabled: boolean,
  dispatch: Dispatch<EditorAction>,
): void {
  useEffect(() => {
    if (!map || !enabled) return;
    let dragging = false;

    const onDown = (event: MapLayerMouseEvent | MapLayerTouchEvent) => {
      const index = event.features?.[0]?.properties?.index;
      if (typeof index !== "number") return;
      // Stops the map from starting a pan with this gesture.
      event.preventDefault();
      dragging = true;
      map.dragPan.disable();
      dispatch({ type: "dragStart", index });
    };
    const onMove = (event: { lngLat: { lng: number; lat: number } }) => {
      if (!dragging) return;
      dispatch({ type: "dragMove", point: [event.lngLat.lng, event.lngLat.lat] as LngLat });
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      map.dragPan.enable();
      dispatch({ type: "dragEnd" });
    };
    const onClick = (event: { point: { x: number; y: number } }) => {
      const hit = map.queryRenderedFeatures(event.point as never, { layers: [ROUTE_LAYERS.hit] });
      if (hit.length === 0) dispatch({ type: "select", index: null });
    };
    const pointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const arrow = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("mousedown", ROUTE_LAYERS.hit, onDown);
    map.on("touchstart", ROUTE_LAYERS.hit, onDown);
    map.on("mousemove", onMove);
    map.on("touchmove", onMove);
    map.on("mouseup", onUp);
    map.on("touchend", onUp);
    map.on("touchcancel", onUp);
    map.on("click", onClick);
    map.on("mouseenter", ROUTE_LAYERS.hit, pointer);
    map.on("mouseleave", ROUTE_LAYERS.hit, arrow);

    return () => {
      map.off("mousedown", ROUTE_LAYERS.hit, onDown);
      map.off("touchstart", ROUTE_LAYERS.hit, onDown);
      map.off("mousemove", onMove);
      map.off("touchmove", onMove);
      map.off("mouseup", onUp);
      map.off("touchend", onUp);
      map.off("touchcancel", onUp);
      map.off("click", onClick);
      map.off("mouseenter", ROUTE_LAYERS.hit, pointer);
      map.off("mouseleave", ROUTE_LAYERS.hit, arrow);
      // Never leave the map unable to pan if editing stops in the middle of a drag.
      map.dragPan.enable();
      arrow();
    };
  }, [map, enabled, dispatch]);
}
