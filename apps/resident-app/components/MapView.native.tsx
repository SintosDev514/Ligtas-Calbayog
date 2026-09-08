import React, { useCallback, useRef, useEffect, useMemo, useState, forwardRef } from "react";
import { View, Platform } from "react-native";
import Constants from "expo-constants";
import { MAPBOX_ACCESS_TOKEN } from "./mapboxData";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const MAP_PAGE = "/map.html";
const MAP_VERSION = 13;

function mapBaseUrl(): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  const host = Constants.expoConfig && Constants.expoConfig.hostUri;
  if (host) {
    const parts = host.split(":");
    const hostname = parts[0];
    const port = parts[1] || "8081";
    return "http://" + hostname + ":" + port;
  }
  return "";
}

const MAP_URL = mapBaseUrl() + MAP_PAGE + "?v=" + MAP_VERSION + "&token=" + encodeURIComponent(MAPBOX_ACCESS_TOKEN);

const Marker: React.FC<any> = () => null;
Marker.displayName = "Marker";

const Polyline: React.FC<any> = () => null;
Polyline.displayName = "Polyline";

const UrlTile: React.FC<any> = () => null;
UrlTile.displayName = "UrlTile";

const MapView = forwardRef<any, any>((
  { style, children, onMarkerPress, onPress, initialRegion, region, mapStyle, mapType, userLocation, showsUserLocation, scrollEnabled, zoomEnabled, rotateEnabled, pitchEnabled, pointerEvents, ...props },
  ref,
) => {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const readyRef = useRef(false);
  const onMarkerPressRef = useRef(onMarkerPress);
  const onPressRef = useRef(onPress);
  const dragHandlerRef = useRef<any>(null);
  const lastRegionRef = useRef<string>("");
  const lastRegionLatLngRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const webViewSource = useMemo(() => ({ uri: MAP_URL }), []);

  const effectiveRegion = region || initialRegion;
  const zoom = effectiveRegion
    ? Math.round(Math.log2(360 / Math.max(effectiveRegion.latitudeDelta || 0.01, 0.001)))
    : 11;

  const markerData = useMemo(() => {
    const markers: any[] = [];
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === "Marker") {
        const { coordinate, pinColor, title, iconName, animated, draggable, onDragEnd, children: mc } = child.props;
        let imageUrl: string | null = null;
        let icon = iconName || null;
        const walk = (node: any) => {
          React.Children.forEach(node, (c: any) => {
            if (!c || typeof c !== "object") return;
            if (imageUrl) return;
            if (React.isValidElement(c)) {
              const uri = (c.props as any)?.source?.uri;
              if (uri) { imageUrl = uri; return; }
              const name = (c.props as any)?.name;
              if (!icon && typeof name === "string") icon = name.toLowerCase();
              if ((c.props as any)?.children) walk((c.props as any).children);
            }
          });
        };
        walk(mc);
        if (icon && ["post-pin", "warning", "shield", "person", "location"].indexOf(icon) === -1) icon = null;
        markers.push({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          color: pinColor || "#3B82F6",
          title: title || null,
          iconName: icon,
          imageUrl,
          animated: !!animated,
          draggable: !!draggable,
        });
        if (draggable && onDragEnd) dragHandlerRef.current = onDragEnd;
      }
    });
    return markers;
  }, [children]);

  const polylineData = useMemo(() => {
    const polylines: any[] = [];
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === "Polyline") {
        const { coordinates, strokeColor, strokeWidth } = child.props;
        polylines.push({
          coordinates: (coordinates || []).map((c: any) => [c.longitude, c.latitude]),
          color: strokeColor || "#3B82F6",
          width: strokeWidth || 4,
        });
      }
    });
    return polylines;
  }, [children]);

  const tileUrl = useMemo(() => {
    let url: string | null = null;
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === "UrlTile" && child.props?.urlTemplate) {
        url = child.props.urlTemplate;
      }
    });
    return url || OSM_TILES;
  }, [children]);

  const sendToWebView = useCallback((msg: any) => {
    try {
      const data = JSON.stringify(msg);
      if (Platform.OS === "web") {
        iframeRef.current?.contentWindow?.postMessage(data, "*");
      } else {
        webViewRef.current?.postMessage(data);
      }
    } catch {}
  }, []);

  const photoDataRef = useRef<{ [url: string]: string }>({});
  const [, forceRender] = useState(0);

  const markerData2 = useMemo(() => {
    return markerData.map((m) => {
      if (m.imageUrl && m.imageUrl.indexOf("data:") !== 0) {
        const b64 = photoDataRef.current[m.imageUrl];
        if (b64) return { ...m, imageUrl: b64 };
      }
      return m;
    });
  }, [markerData]);

  useEffect(() => {
    let alive = true;
    const urls = Array.from(new Set(
      markerData.map((m: any) => m.imageUrl).filter((u: any) => u && u.indexOf("data:") !== 0),
    ));
    urls.forEach(async (u: string) => {
      if (photoDataRef.current[u]) return;
      try {
        const res = await fetch(u);
        const blob = await res.blob();
        const b64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(String(fr.result || ""));
          fr.onerror = () => reject(new Error("read"));
          fr.readAsDataURL(blob);
        });
        if (alive && b64 && !photoDataRef.current[u]) {
          photoDataRef.current[u] = b64;
          forceRender((x) => x + 1);
        }
      } catch {}
    });
    return () => { alive = false; };
  }, [markerData]);

  const sendMapState = useCallback(() => {
    sendToWebView({
      type: "init",
      region: { latitude: effectiveRegion?.latitude ?? 12.07, longitude: effectiveRegion?.longitude ?? 124.6, zoom },
      interactive: { scroll: scrollEnabled, zoom: zoomEnabled, rotate: rotateEnabled, pitch: pitchEnabled },
    });
    sendToWebView({ type: "tiles", url: tileUrl });
    if (mapStyle) sendToWebView({ type: "setStyle", style: mapStyle });
    sendToWebView({ type: "markers", data: markerData2 });
    sendToWebView({ type: "polylines", data: polylineData });
    if (userLocation?.latitude != null && userLocation?.longitude != null) {
      sendToWebView({ type: "userLocation", latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
  }, [effectiveRegion, zoom, tileUrl, mapStyle, markerData2, polylineData, userLocation, sendToWebView, scrollEnabled, zoomEnabled, rotateEnabled, pitchEnabled]);

  const onMessage = useCallback((event: any) => {
    try {
      const raw = event?.nativeEvent?.data ?? event?.data;
      const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (msg.type === "ready" && !readyRef.current) {
        readyRef.current = true;
        sendMapState();
      }
      if (msg.type === "markerPress") {
        onMarkerPressRef.current?.({
          coordinate: { latitude: msg.data.latitude, longitude: msg.data.longitude },
          nativeEvent: { coordinate: { latitude: msg.data.latitude, longitude: msg.data.longitude } },
        });
      }
      if (msg.type === "mapPress") {
        const coord = { latitude: msg.data.latitude, longitude: msg.data.longitude };
        onPressRef.current?.({ nativeEvent: { coordinate: coord }, coordinate: coord });
      }
      if (msg.type === "markerDragEnd") {
        const coord = { latitude: msg.data.latitude, longitude: msg.data.longitude };
        dragHandlerRef.current?.({ nativeEvent: { coordinate: coord }, coordinate: coord });
      }
    } catch {}
  }, [sendMapState]);

  const onFrameMessage = useCallback((event: any) => {
    if (event.source !== iframeRef.current?.contentWindow) return;
    onMessage(event);
  }, [onMessage]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    window.addEventListener("message", onFrameMessage);
    return () => window.removeEventListener("message", onFrameMessage);
  }, [onFrameMessage]);

  useEffect(() => {
    if (readyRef.current) sendMapState();
  }, [sendMapState, markerData, polylineData, tileUrl]);

  useEffect(() => {
    if (!readyRef.current || !effectiveRegion) return;
    const lat = effectiveRegion.latitude;
    const lng = effectiveRegion.longitude;
    const key = `${lat},${lng}`;
    if (key === lastRegionRef.current) return;
    lastRegionRef.current = key;
    const prev = lastRegionLatLngRef.current;
    lastRegionLatLngRef.current = { latitude: lat, longitude: lng };
    if (!prev) return;
    const far = Math.abs(lat - prev.latitude) > 0.01 || Math.abs(lng - prev.longitude) > 0.01;
    if (!far) return;
    sendToWebView({ type: "regionChange", latitude: lat, longitude: lng, zoom: null });
  }, [effectiveRegion, sendToWebView]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (mapStyle) sendToWebView({ type: "setStyle", style: mapStyle });
  }, [mapStyle, sendToWebView]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (userLocation?.latitude != null && userLocation?.longitude != null) {
      sendToWebView({ type: "userLocation", latitude: userLocation.latitude, longitude: userLocation.longitude });
    } else if (showsUserLocation) {
      sendToWebView({ type: "userLocation", latitude: null, longitude: null });
    }
  }, [userLocation, showsUserLocation, sendToWebView]);

  if (Platform.OS === "web") {
    return (
      <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]} pointerEvents={pointerEvents}>
        <iframe ref={iframeRef} src={MAP_URL} style={{ width: "100%", height: "100%", border: 0 }} title="Map" />
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]} pointerEvents={pointerEvents} collapsable={false}>
      <WebView
        ref={webViewRef}
        source={webViewSource}
        style={{ flex: 1, backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        removeClippedSubviews={false}
      />
    </View>
  );
});

MapView.displayName = "MapView";

export { MapView as default, Marker, Polyline, UrlTile };