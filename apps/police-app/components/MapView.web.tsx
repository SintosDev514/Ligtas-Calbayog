import React, { useEffect, useRef, useMemo, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TILES: Record<string, string> = {
  light: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  dark: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  street: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};

const TILE_ATTR: Record<string, string> = {
  light: "© CARTO",
  dark: "© CARTO",
  street: "© OpenStreetMap contributors",
};

const MAP_STYLE_NAMES = Object.keys(TILES);

const MAPILLARY_TOKEN = "MLY|27240407492254490|a5c94f86b7fb9a1e9728f1eddcb49110";
const MAPILLARY_TILE_URL = `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${encodeURIComponent(MAPILLARY_TOKEN)}`;

type MapStyle = "light" | "dark" | "satellite";

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface RouteData {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

interface MapViewProps {
  style?: React.CSSProperties;
  region?: Region;
  initialRegion?: Region;
  children?: React.ReactNode;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  showsUserLocation?: boolean;
  mapStyle?: MapStyle;
  routeData?: RouteData | null;
  pitch?: number;
  onPress?: (e: any) => void;
  onMarkerPress?: (markerData: MarkerProps) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  popupHtml?: string;
  animate?: boolean;
  children?: React.ReactNode;
}

const toMapStyle = (s: any): React.CSSProperties => {
  if (!s) return { width: "100%", height: "100%", flex: 1 };
  const result: React.CSSProperties = {};
  if (s.width) result.width = s.width;
  if (s.height) result.height = s.height;
  if (s.flex != null) result.flex = s.flex;
  if (s.borderRadius) result.borderRadius = s.borderRadius as any;
  return result;
};

const makeBaseStyle = (active: MapStyle): maplibregl.StyleSpecification => ({
  version: 8,
  sources: Object.fromEntries(
    MAP_STYLE_NAMES.map((k) => [
      `tiles-${k}`,
      { type: "raster", tiles: [TILES[k]], tileSize: 256, attribution: TILE_ATTR[k] } as maplibregl.RasterTileSource,
    ]),
  ) as any,
  layers: MAP_STYLE_NAMES.map((k) => ({
    id: `tiles-${k}`,
    type: "raster" as const,
    source: `tiles-${k}`,
    layout: { visibility: k === active ? "visible" as const : "none" as const },
  })),
});

const MapView: React.FC<MapViewProps> = ({
  style,
  region,
  initialRegion,
  children,
  scrollEnabled = true,
  showsUserLocation,
  mapStyle = "light",
  routeData,
  pitch,
  onPress,
  onMarkerPress,
  onRegionChangeComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const initializedRef = useRef(false);

  const activeRegion = region || initialRegion;

  const markerData = useMemo(() => {
    const markers: MarkerProps[] = [];
    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement(child) &&
        (child as any).type?.displayName === "Marker"
      ) {
        markers.push(child.props as MarkerProps);
      }
    });
    return markers;
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
      pitch: pitch ?? 0,
      maxPitch: 85,
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

    const addMapillary = () => {
      if (map.getSource("mapillary")) return;
      map.addSource("mapillary", {
        type: "vector",
        tiles: [MAPILLARY_TILE_URL],
        minzoom: 0,
        maxzoom: 14,
      });
      map.addLayer({
        id: "mly-overview",
        type: "circle",
        source: "mapillary",
        "source-layer": "overview",
        minzoom: 0,
        maxzoom: 6,
        paint: {
          "circle-color": "#05CB63",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 1.5, 5, 4],
          "circle-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "mly-sequences",
        type: "line",
        source: "mapillary",
        "source-layer": "sequence",
        minzoom: 6,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#05CB63",
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.5, 12, 3, 14, 2, 18, 3],
          "line-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "mly-images",
        type: "circle",
        source: "mapillary",
        "source-layer": "image",
        minzoom: 14,
        paint: {
          "circle-color": "#05CB63",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 4, 18, 9],
          "circle-opacity": 0.95,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.7,
        },
      });
    };

    map.on("load", () => {
      map.resize();
      addMapillary();
    });

    if (onPress) {
      map.on("click", (e) => {
        onPress({
          nativeEvent: {
            coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng },
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

    map.on("load", () => map.resize());
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, []);

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
    MAP_STYLE_NAMES.forEach((k) => {
      mapRef.current!.setLayoutProperty(
        `tiles-${k}`,
        "visibility",
        k === mapStyle ? "visible" : "none",
      );
    });
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const style = document.createElement("style");
    if (!document.getElementById("marker-anim")) {
      style.id = "marker-anim";
      style.textContent = `
@keyframes marker-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
  70% { box-shadow: 0 0 0 18px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
.marker-animate {
  animation: marker-pulse 2s infinite;
}
`;
      document.head.appendChild(style);
    }

    markerData.forEach((m) => {
      const el = document.createElement("div");
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "50%";
      el.style.background = m.pinColor || "#3B82F6";
      el.style.border = `3px solid ${m.animate ? '#EF4444' : '#22C55E'}`;
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      if (m.animate) el.classList.add("marker-animate");

      if (m.children) {
        if (React.isValidElement(m.children)) {
          const props = (m.children as any).props;
          const src = props?.src || props?.source?.uri;
          if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.style.width = "28px";
            img.style.height = "28px";
            img.style.borderRadius = "50%";
            img.style.objectFit = "cover";
            el.appendChild(img);
          }
        }
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([m.coordinate.longitude, m.coordinate.latitude])
        .addTo(mapRef.current!);

      if (m.popupHtml) {
        const popup = new maplibregl.Popup({
          offset: 25,
          maxWidth: "300px",
          closeButton: true,
          closeOnClick: false,
        }).setHTML(m.popupHtml);
        marker.setPopup(popup);
      } else if (m.title) {
        const popup = new maplibregl.Popup({ offset: 25 }).setText(m.title);
        marker.setPopup(popup);
      }

      el.addEventListener("click", () => {
        if (onMarkerPress) onMarkerPress(m);
      });

      markersRef.current.push(marker);
    });
  }, [markerData, onMarkerPress]);

  useEffect(() => {
    if (!mapRef.current || !showsUserLocation) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const clearRoute = () => {
      try {
        if (map.getSource("route")) {
          map.removeLayer("route-line");
          map.removeSource("route");
        }
      } catch (e) {}
    };
    if (!routeData || !routeData.geometry) {
      clearRoute();
      return;
    }
    clearRoute();
    map.addSource("route", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: routeData.geometry },
    });
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#EF4444",
        "line-width": 5,
        "line-opacity": 0.85,
      },
    });
    const coords = routeData.geometry.coordinates;
    if (coords && coords.length > 0) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0]),
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1000 });
    }
  }, [routeData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
  }, [routeData]);

  return (
    <div
      ref={containerRef}
      style={{
        ...toMapStyle(style),
        pointerEvents: undefined,
      }}
    />
  );
};

MapView.displayName = "MapView";

const Marker: React.FC<MarkerProps> = () => null;
Marker.displayName = "Marker";

export default MapView;
export { Marker };
