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
  bearing?: number;
  userHeading?: number;
  onPress?: (e: any) => void;
  onMarkerPress?: (markerData: MarkerProps) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  popupHtml?: string;
  markerHtml?: string;
  animate?: boolean;
  heading?: number;
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
  bearing,
  userHeading,
  onPress,
  onMarkerPress,
  onRegionChangeComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const arrowElRef = useRef<HTMLDivElement | null>(null);
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
      bearing: bearing ?? 0,
      maxPitch: 85,
      scrollZoom: scrollEnabled,
      dragPan: scrollEnabled,
      dragRotate: bearing != null,
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
@keyframes emergency-pulse-1 {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
  100% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
}
@keyframes emergency-pulse-2 {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
  100% { box-shadow: 0 0 0 26px rgba(239,68,68,0); }
}
@keyframes emergency-glow {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(239,68,68,0.4)); }
  50% { filter: drop-shadow(0 0 10px rgba(239,68,68,0.7)); }
}
@keyframes user-pulse {
  0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
  70% { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
  100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
}
.marker-animate {
  animation: emergency-pulse-1 1.4s ease-out infinite, emergency-glow 2s ease-in-out infinite;
}
.marker-animate::after {
  content: '';
  position: absolute;
  top: -2px; left: -2px; right: -2px; bottom: -2px;
  border-radius: 50%;
  animation: emergency-pulse-2 1.4s ease-out infinite;
  pointer-events: none;
}
.user-location-animate {
  animation: user-pulse 2.5s infinite;
}
`;
      document.head.appendChild(style);
    }

    markerData.forEach((m) => {
      const isUserLoc = m.pinColor === "#3B82F6" && !m.animate;
      const isCustom = !!m.markerHtml;
      const hasHeading = typeof m.heading === "number" && !isNaN(m.heading);
      const isArrow = isUserLoc && hasHeading;
      const el = document.createElement("div");

      if (isArrow) {
        arrowElRef.current = el;
        el.style.width = "30px";
        el.style.height = "30px";
        el.style.borderRadius = "50%";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";
        el.innerHTML = `
          <svg width="30" height="30" viewBox="0 0 30 30" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
            <circle cx="15" cy="15" r="13" fill="rgba(59,130,246,0.25)" stroke="#3B82F6" stroke-width="2.5"/>
            <g transform="rotate(${m.heading}, 15, 15)">
              <polygon points="15,3 21,22 15,17 9,22" fill="#3B82F6" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
            </g>
          </svg>`;
        el.classList.add("user-location-animate");
      } else if (isCustom) {
        el.style.width = "26px";
        el.style.height = "26px";
        el.style.borderRadius = "50%";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";
        el.style.overflow = "hidden";
        el.style.background = "rgba(0,0,0,0.6)";
        el.style.border = "2px solid rgba(251,191,36,0.6)";
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
        el.innerHTML = m.markerHtml!;
      } else {
        el.style.position = "relative";
        el.style.width = isUserLoc ? "18px" : "26px";
        el.style.height = isUserLoc ? "18px" : "26px";
        el.style.borderRadius = "50%";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";
        el.style.overflow = "visible";
        el.style.background = m.animate ? "#EF4444" : (m.pinColor || "#3B82F6");
        el.style.border = `2px solid ${m.animate ? '#FCA5A5' : isUserLoc ? '#fff' : '#22C55E'}`;
        el.style.boxShadow = isUserLoc
          ? "0 1px 4px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(59,130,246,0.3)"
          : "0 2px 8px rgba(0,0,0,0.35)";
        if (m.animate) el.classList.add("marker-animate");
        if (isUserLoc) el.classList.add("user-location-animate");
      }

      if (!isArrow && !isCustom && m.children) {
        if (React.isValidElement(m.children)) {
          const props = (m.children as any).props;
          const src = props?.src || props?.source?.uri;
          if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.style.width = "100%";
            img.style.height = "100%";
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
          el.style.width = "14px";
          el.style.height = "14px";
          el.style.borderRadius = "50%";
          el.style.background = "#3B82F6";
          el.style.border = "2px solid #fff";
          el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(59,130,246,0.3)";
          el.classList.add("user-location-animate");
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
    if (!arrowElRef.current) return;
    if (typeof userHeading !== "number") return;
    arrowElRef.current.innerHTML = `
      <svg width="30" height="30" viewBox="0 0 30 30" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
        <circle cx="15" cy="15" r="13" fill="rgba(59,130,246,0.25)" stroke="#3B82F6" stroke-width="2.5"/>
        <g transform="rotate(${userHeading}, 15, 15)">
          <polygon points="15,3 21,22 15,17 9,22" fill="#3B82F6" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
        </g>
      </svg>`;
  }, [userHeading]);

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
