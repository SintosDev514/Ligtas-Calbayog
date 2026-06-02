import React, { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  showsUserLocation?: boolean;
  onPress?: (e: any) => void;
  onMarkerPress?: (markerData: MarkerProps) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  popupHtml?: string;
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

const MapView: React.FC<MapViewProps> = ({
  style,
  region,
  initialRegion,
  children,
  scrollEnabled = true,
  showsUserLocation,
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
      style: {
        version: 8,
        sources: {
          tiles: {
            type: "raster",
            tiles: [TILE_URL],
            tileSize: 256,
            maxzoom: 20,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "tiles",
            type: "raster",
            source: "tiles",
            paint: { "raster-fade-duration": 0 },
          },
        ],
      } as maplibregl.StyleSpecification,
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
      attributionControl: true,
      fadeDuration: 0,
      renderWorldCopies: false,
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
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markerData.forEach((m) => {
      const el = document.createElement("div");
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "50%";
      el.style.background = m.pinColor || "#3B82F6";
      el.style.border = "3px solid #fff";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";

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
