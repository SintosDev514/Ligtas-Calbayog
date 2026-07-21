import React, { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type MapStyle = "light" | "dark";

const TILES: Record<MapStyle, string> = {
  light: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  dark: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
};

const TILE_ATTR: Record<MapStyle, string> = {
  light: "© CARTO",
  dark: "© CARTO",
};

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MapViewProps {
  style?: React.CSSProperties;
  region?: Region;
  initialRegion?: Region;
  children?: React.ReactNode;
  mapType?: string;
  mapStyle?: MapStyle;
  pointerEvents?: React.CSSProperties["pointerEvents"];
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  showsUserLocation?: boolean;
  showsCompass?: boolean;
  loadingEnabled?: boolean;
  onPress?: (e: any) => void;
  onMarkerPress?: (e: any) => void;
  onMarkerDragEnd?: (e: any) => void;
  onUserLocationChange?: (e: any) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  iconName?: string;
  draggable?: boolean;
  children?: React.ReactNode;
}

interface PolylineProps {
  coordinates: { latitude: number; longitude: number }[];
  strokeColor?: string;
  strokeWidth?: number;
}

const makeBaseStyle = (active: MapStyle): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    "tiles-light": {
      type: "raster",
      tiles: [TILES.light],
      tileSize: 256,
      maxzoom: 20,
      attribution: TILE_ATTR.light,
    },
    "tiles-dark": {
      type: "raster",
      tiles: [TILES.dark],
      tileSize: 256,
      maxzoom: 20,
      attribution: TILE_ATTR.dark,
    },
  },
  layers: [
    {
      id: "tiles-light",
      type: "raster",
      source: "tiles-light",
      paint: { "raster-fade-duration": 0 },
      layout: { visibility: active === "light" ? "visible" : "none" },
    },
    {
      id: "tiles-dark",
      type: "raster",
      source: "tiles-dark",
      paint: { "raster-fade-duration": 0 },
      layout: { visibility: active === "dark" ? "visible" : "none" },
    },
  ],
});

const toMapStyle = (s: any): React.CSSProperties => {
  if (!s) return { width: "100%", height: "100%", flex: 1 };
  if (typeof s === "number") return { width: s, height: s };
  const result: React.CSSProperties = {};
  if (s.width) result.width = s.width;
  if (s.height) result.height = s.height;
  if (s.flex != null) result.flex = s.flex;
  if (s.borderRadius) result.borderRadius = s.borderRadius as any;
  return result;
};

const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-layer";

const MapView: React.FC<MapViewProps> = ({
  style,
  region,
  initialRegion,
  children,
  mapStyle = "light",
  pointerEvents,
  scrollEnabled = true,
  zoomEnabled = true,
  showsUserLocation,
  showsCompass,
  onPress,
  onMarkerPress,
  onMarkerDragEnd,
  onUserLocationChange,
  onRegionChangeComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const initializedRef = useRef(false);

  const activeRegion = region || initialRegion;

  const markerData = useMemo(() => {
    const markers: {
      coordinate: { latitude: number; longitude: number };
      title?: string;
      pinColor?: string;
      iconName?: string;
      draggable?: boolean;
    }[] = [];
    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement(child) &&
        (child as any).type?.displayName === "Marker"
      ) {
        const props = child.props as MarkerProps;
        markers.push({
          coordinate: props.coordinate,
          title: props.title,
          pinColor: props.pinColor,
          iconName: props.iconName,
          draggable: props.draggable,
        });
      }
    });
    return markers;
  }, [children]);

  const polylineData = useMemo(() => {
    const polylines: {
      coordinates: [number, number][];
      color: string;
      width: number;
    }[] = [];
    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement(child) &&
        (child as any).type?.displayName === "Polyline"
      ) {
        const props = child.props as PolylineProps;
        polylines.push({
          coordinates: props.coordinates.map((c) => [c.longitude, c.latitude]),
          color: props.strokeColor || "#3B82F6",
          width: props.strokeWidth || 4,
        });
      }
    });
    return polylines;
  }, [children]);

  useEffect(() => {
    if (!containerRef.current || !activeRegion || initializedRef.current)
      return;
    initializedRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBaseStyle(mapStyle),
      center: [activeRegion.longitude, activeRegion.latitude],
      zoom: Math.round(
        Math.log2(360 / Math.max(activeRegion.latitudeDelta, 0.001)),
      ),
      minZoom: 1,
      maxZoom: 19,
      scrollZoom: scrollEnabled,
      dragPan: scrollEnabled,
      dragRotate: false,
      touchZoomRotate: scrollEnabled,
      doubleClickZoom: scrollEnabled,
      keyboard: scrollEnabled,
      attributionControl: {},
      fadeDuration: 0,
      renderWorldCopies: false,
    });

    if (showsCompass) {
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
        }),
      );
    }

    if (onPress) {
      map.on("click", (e: any) => {
        onPress({
          nativeEvent: {
            coordinate: {
              latitude: e.lngLat.lat,
              longitude: e.lngLat.lng,
            },
          },
        });
      });
    }

    if (onRegionChangeComplete) {
      map.on("moveend", () => {
        const center = map.getCenter();
        const bounds = map.getBounds();
        onRegionChangeComplete({
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: bounds.getNorthEast().lat - bounds.getSouthWest().lat,
          longitudeDelta: bounds.getNorthEast().lng - bounds.getSouthWest().lng,
        });
      });
    }

    map.on("load", () => {
      map.resize();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    (["light", "dark"] as MapStyle[]).forEach((k) => {
      mapRef.current!.setLayoutProperty(
        `tiles-${k}`,
        "visibility",
        k === mapStyle ? "visible" : "none",
      );
    });
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (region) {
      mapRef.current.flyTo({
        center: [region.longitude, region.latitude],
        duration: 300,
      });
    }
  }, [region]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markerData.forEach((m) => {
      const el = document.createElement("div");
      if (m.iconName === "post-pin") {
        el.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="#fbbf24" stroke="#d97706" stroke-width="0.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>';
        el.style.cursor = "pointer";
      } else {
        el.style.width = "24px";
        el.style.height = "24px";
        el.style.borderRadius = "50%";
        el.style.background = m.pinColor || "#EF4444";
        el.style.border = "3px solid #fff";
        el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
        el.style.cursor = m.draggable ? "grab" : "pointer";
      }

      const markerOpts: any = { element: el };
      if (m.draggable) markerOpts.draggable = true;

      const marker = new maplibregl.Marker(markerOpts)
        .setLngLat([m.coordinate.longitude, m.coordinate.latitude])
        .addTo(mapRef.current!);

      if (m.title) {
        const popup = new maplibregl.Popup().setText(m.title);
        marker.setPopup(popup);
      }

      if (m.draggable && onMarkerDragEnd) {
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          onMarkerDragEnd({
            nativeEvent: {
              coordinate: { latitude: lngLat.lat, longitude: lngLat.lng },
            },
          });
        });
      }

      markersRef.current.push(marker);
    });
  }, [markerData]);

  useEffect(() => {
    if (!mapRef.current || !showsUserLocation) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (onUserLocationChange) {
          onUserLocationChange({
            nativeEvent: {
              coordinate: {
                latitude,
                longitude,
                accuracy,
                altitude: null,
                heading: null,
                speed: null,
              },
            },
          });
        }

        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.style.width = "16px";
          el.style.height = "16px";
          el.style.borderRadius = "50%";
          el.style.background = "#1565C0";
          el.style.border = "3px solid #fff";
          el.style.boxShadow = "0 0 0 2px rgba(21,101,192,0.4)";

          userMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(mapRef.current!);
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
      },
      (err) => console.warn("Geolocation error:", err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [showsUserLocation]);

  // Render polyline(s) as GeoJSON sources/layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing route source/layer
    try {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    } catch {}

    if (polylineData.length === 0) return;

    const features: any[] = polylineData.map((p) => ({
      type: "Feature",
      properties: { color: p.color, width: p.width },
      geometry: {
        type: "LineString",
        coordinates: p.coordinates,
      },
    }));

    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    // Add a layer per polyline since MapLibre doesn't support data-driven paint well for simple lines
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["get", "width"],
        "line-opacity": 0.8,
      },
    });
  }, [polylineData]);

  const mapContainerStyle = toMapStyle(style);

  return (
    <div
      ref={containerRef}
      style={{
        ...mapContainerStyle,
        pointerEvents: pointerEvents === "none" ? ("none" as any) : undefined,
      }}
    />
  );
};

MapView.displayName = "MapView";

const Marker: React.FC<MarkerProps> = () => null;
Marker.displayName = "Marker";

const Polyline: React.FC<PolylineProps> = () => null;
Polyline.displayName = "Polyline";

const UrlTile: React.FC<{ urlTemplate: string }> = () => null;
UrlTile.displayName = "UrlTile";

export default MapView;
export { Marker, Polyline, UrlTile };
