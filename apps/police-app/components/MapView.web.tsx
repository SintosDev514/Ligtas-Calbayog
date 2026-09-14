import React, { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

type MapStyle = "light" | "dark" | "street";

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
  clusterGroup?: string;
  id?: string;
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

const ANIMATION_CSS = `
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
.report-dot{width:15px;height:15px;border-radius:50%;background:var(--pc);border:2px solid #fff;cursor:pointer;position:relative;overflow:visible;animation:report-pulse 1.6s ease-out infinite}
@keyframes report-pulse{0%{box-shadow:0 0 0 0 var(--pulse-1)}70%{box-shadow:0 0 0 15px var(--pulse-2)}100%{box-shadow:0 0 0 0 var(--pulse-2)}}
.leaflet-popup-content-wrapper {
  border-radius: 8px;
  font-size: 12px;
}
.leaflet-popup-content {
  margin: 8px 10px;
  font-family: sans-serif;
  max-width: 220px;
}
`;

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const rgb = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(rgb, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const MapView: React.FC<MapViewProps> = ({
  style,
  region,
  initialRegion,
  children,
  scrollEnabled = true,
  showsUserLocation,
  mapStyle = "street",
  routeData,
  pitch,
  bearing,
  userHeading,
  onPress,
  onMarkerPress,
  onRegionChangeComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const routeLayerRef = useRef<L.Layer | null>(null);
  const clusterLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const arrowMarkerRef = useRef<L.Marker | null>(null);
  const initializedRef = useRef(false);
  const onMarkerPressRef = useRef(onMarkerPress);
  onMarkerPressRef.current = onMarkerPress;

  const activeRegion = region || initialRegion;

  const markerData = useMemo(() => {
    const markers: MarkerProps[] = [];
    let sig = "empty";
    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement(child) &&
        (child as any).type?.displayName === "Marker"
      ) {
        const p = child.props as MarkerProps;
        markers.push(p);
        sig +=
          `${p.id ?? ""}|${p.title ?? ""}|${p.pinColor ?? ""}|` +
          `${p.coordinate?.latitude ?? ""},${p.coordinate?.longitude ?? ""}|` +
          `${p.animate ? 1 : 0}|${p.clusterGroup ?? ""}|` +
          `${typeof p.heading}|${p.markerHtml ? 1 : 0}|${p.popupHtml ? 1 : 0};`;
      }
    });
    return { markers, sig };
  }, [children]);

  const makeIcon = (m: MarkerProps, isArrow: boolean, isCustom: boolean, isUserLoc: boolean) => {
    const el = document.createElement("div");

    if (isArrow) {
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
      el.style.position = "relative";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.cursor = "pointer";
      el.style.overflow = "visible";
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
      el.style.background = m.pinColor || "#3B82F6";
      el.style.border = "2px solid #fff";
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

    return L.divIcon({
      html: el.outerHTML,
      className: "",
      iconSize: isArrow ? [30, 30] : [isCustom ? 30 : (isUserLoc ? 18 : 26), isCustom ? 30 : (isUserLoc ? 18 : 26)],
      iconAnchor: isArrow ? [15, 15] : [isCustom ? 15 : (isUserLoc ? 9 : 13), isCustom ? 15 : (isUserLoc ? 9 : 13)],
    });
  };

  const syncReportClusters = () => {
    clusterLayerRef.current.clearLayers();
    markerData.markers
      .filter(
        (m) =>
          m.clusterGroup &&
          m.coordinate &&
          typeof m.coordinate.latitude === "number" &&
          typeof m.coordinate.longitude === "number",
      )
      .forEach((m) => {
        const color = m.pinColor || "#f59e0b";
        const el = document.createElement("div");
        el.className = "report-dot";
        el.style.background = color;
        el.style.setProperty("--pc", color);
        el.style.setProperty("--pulse-1", hexToRgba(color, 0.5));
        el.style.setProperty("--pulse-2", hexToRgba(color, 0));
        const marker = L.marker([m.coordinate.latitude, m.coordinate.longitude], {
          icon: L.divIcon({
            html: el.outerHTML,
            className: "",
            iconSize: [15, 15],
            iconAnchor: [7.5, 7.5],
          }),
        });
        marker.on("click", () => {
          if (onMarkerPressRef.current) {
            onMarkerPressRef.current({
              coordinate: { latitude: m.coordinate.latitude, longitude: m.coordinate.longitude },
              id: m.id || undefined,
              title: m.title || undefined,
            });
          }
        });
        if (m.title) marker.bindPopup(m.title, { offset: [0, -8] });
        clusterLayerRef.current.addLayer(marker);
      });
  };

  useEffect(() => {
    if (!containerRef.current || !activeRegion || initializedRef.current) return;
    initializedRef.current = true;

    // Inject animation CSS
    if (!document.getElementById("leaflet-marker-anim")) {
      const style = document.createElement("style");
      style.id = "leaflet-marker-anim";
      style.textContent = ANIMATION_CSS;
      document.head.appendChild(style);
    }

    const zoom = Math.round(
      Math.log2(360 / Math.max(activeRegion.latitudeDelta, 0.001)),
    );

    const map = L.map(containerRef.current, {
      center: [activeRegion.latitude, activeRegion.longitude],
      zoom,
      minZoom: 1,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: scrollEnabled,
      dragging: scrollEnabled,
      touchZoom: scrollEnabled,
      doubleClickZoom: scrollEnabled,
      keyboard: scrollEnabled,
    });

    const tile = L.tileLayer(TILES[mapStyle] || TILES.light, {
      attribution: TILE_ATTR[mapStyle] || TILE_ATTR.light,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tile;
    markersLayerRef.current.addTo(map);
    clusterLayerRef.current.addTo(map);

    if (onPress) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onPress({
          nativeEvent: {
            coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng },
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

    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) {}
    }, 300);
    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) {}
    }, 1200);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        try { map.invalidateSize(); } catch (e) {}
      });
      resizeObserver.observe(containerRef.current);
    }

    mapRef.current = map;

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!region) return;
    const c = mapRef.current.getCenter();
    const dist = Math.abs(c.lng - region.longitude) + Math.abs(c.lat - region.latitude);
    if (dist > 0.0001) {
      mapRef.current.flyTo([region.latitude, region.longitude], undefined, {
        duration: 0.3,
      });
    }
  }, [region]);

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(TILES[mapStyle] || TILES.light, {
      attribution: TILE_ATTR[mapStyle] || TILE_ATTR.light,
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersLayerRef.current.clearLayers();

    markerData.markers.forEach((m) => {
      if (m.clusterGroup) return;
      const isUserLoc = m.pinColor === "#3B82F6" && !m.animate;
      const isCustom = !!m.markerHtml;
      const hasHeading = typeof m.heading === "number" && !isNaN(m.heading);
      const isArrow = isUserLoc && hasHeading;

      const icon = makeIcon(m, isArrow, isCustom, isUserLoc);
      const marker = L.marker([m.coordinate.latitude, m.coordinate.longitude], { icon })
        .addTo(markersLayerRef.current);

      if (isArrow) arrowMarkerRef.current = marker;

      if (m.popupHtml) {
        marker.bindPopup(m.popupHtml, {
          offset: [0, -13],
          maxWidth: 300,
          closeButton: true,
          autoClose: false,
          closeOnClick: false,
        });
      } else if (m.title) {
        marker.bindPopup(m.title, { offset: [0, -13] });
      }

      marker.on("click", () => {
        if (onMarkerPressRef.current) onMarkerPressRef.current(m);
      });
    });

    syncReportClusters();
  }, [markerData.sig]);

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

          const icon = L.divIcon({
            html: el.outerHTML,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          userMarkerRef.current = L.marker([latitude, longitude], { icon })
            .addTo(mapRef.current!);
        } else {
          userMarkerRef.current.setLatLng([latitude, longitude]);
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

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (!routeData || !routeData.geometry) return;

    const latlngs: L.LatLngExpression[] = routeData.geometry.coordinates.map(
      (c) => [c[1], c[0]] as [number, number],
    );

    const line = L.polyline(latlngs, {
      color: "#EF4444",
      weight: 5,
      opacity: 0.85,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map);

    routeLayerRef.current = line;
  }, [routeData]);

  useEffect(() => {
    if (typeof userHeading !== "number") return;
    const el = arrowMarkerRef.current?.getElement?.();
    if (!el) return;
    const svg = el.querySelector("svg");
    const g = svg?.querySelector("g");
    if (g) g.setAttribute("transform", `rotate(${userHeading}, 15, 15)`);
  }, [userHeading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { map.invalidateSize(); } catch (e) {}
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
