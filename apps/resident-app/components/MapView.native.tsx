import React, { useCallback, useRef, useEffect, useMemo, forwardRef } from "react";
import { View, Platform } from "react-native";
import Constants from "expo-constants";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const MAP_PAGE = "/map.html";
const MAP_VERSION = 34;

// The self-contained map page (HTML + inline MapLibre engine) is bundled directly
// into the JavaScript bundle as a string. This avoids ALL file:// / asset-extraction /
// dev-server resolution problems that break standalone (release) APKs:
//  - expo-asset's Asset.fromModule() returns an empty URI unless expo-updates is
//    installed, so extraction throws in a standalone APK.
//  - A scheme-less URL like "/map.html?v=34" makes Android WebView load
//    file:///map.html -> net::ERR_FILE_NOT_FOUND (DOMAIN_UNDEFINED).
// Loading the HTML inline via <WebView source={{ html }}> works identically in
// Expo Go and in an installed APK, and all network resources (MapLibre JS/CSN,
// tile URLs, avatars) are absolute HTTPS URLs.
const MAP_HTML: string | null = (() => {
  try {
    const mod = require("@/assets/map-page-html.js");
    return typeof mod === "string" ? mod : null;
  } catch {
    return null;
  }
})();

/**
 * Returns an absolute base URL (scheme + host) for the dev/metro server, or null
 * when running without one (e.g. a release/standalone APK). Never returns a
 * scheme-less or relative value so WebView can not be pointed at a bogus file:// URL.
 */
function mapBaseUrl(): string | null {
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
  return null;
}

function mapServerUrl(): string | null {
  const base = mapBaseUrl();
  return base ? base + MAP_PAGE + "?v=" + MAP_VERSION : null;
}

const Marker: React.FC<any> = () => null;
Marker.displayName = "Marker";

const Polyline: React.FC<any> = () => null;
Polyline.displayName = "Polyline";

const UrlTile: React.FC<any> = () => null;
UrlTile.displayName = "UrlTile";

const MapView = forwardRef<any, any>((
  { style, children, onMarkerPress, onPress, initialRegion, region, mapStyle, mapType, userLocation, showsUserLocation, focus: focusLocation, scrollEnabled, zoomEnabled, rotateEnabled, pitchEnabled, pointerEvents, ...props },
  ref,
) => {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const readyRef = useRef(false);
  const onMarkerPressRef = useRef(onMarkerPress);
  const onPressRef = useRef(onPress);
  const dragHandlerRef = useRef<any>(null);
  const markersConfirmedRef = useRef(false);

  const webViewSource = useMemo(() => {
    if (Platform.OS === "web") {
      const serverUrl = mapServerUrl();
      return { uri: serverUrl || "about:blank" };
    }
    // Native: load the self-contained HTML directly from the JS bundle. This is the
    // exact same page that the dev server used to serve in Expo Go, so behaviour is
    // identical in Expo Go and in a standalone APK.
    if (MAP_HTML) {
      return { html: MAP_HTML };
    }
    // Extremely unlikely fallback (MAP_HTML is embedded in the bundle). Only ever
    // return an absolute URL that has a scheme + host so the WebView is never given
    // a scheme-less path that resolves to a non-existent file:/// URL.
    const serverUrl = mapServerUrl();
    if (serverUrl) {
      return { uri: serverUrl };
    }
    return { html: "<!DOCTYPE html><html><body style=\"background:#F1F5F9\"></body></html>" };
  }, []);

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
          latitude: Number(coordinate.latitude),
          longitude: Number(coordinate.longitude),
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

  const markerDataSig = useMemo(
    () =>
      JSON.stringify(
        markerData.map((m: any) =>
          [m.latitude, m.longitude, m.color, m.title || "", m.iconName || "", m.imageUrl || "", m.animated ? 1 : 0, m.draggable ? 1 : 0].join("|"),
        ),
      ),
    [markerData],
  );

  const latestMarkerDataRef = useRef(markerData);
  latestMarkerDataRef.current = markerData;

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

  const focusRef = useRef(focusLocation);

  useEffect(() => {
    focusRef.current = focusLocation;
    if (!readyRef.current) return;
    if (focusLocation?.latitude != null && focusLocation?.longitude != null) {
      sendToWebView({ type: "focus", ...focusLocation });
    }
  }, [focusLocation, sendToWebView]);

  const sendInit = useCallback(() => {
    sendToWebView({
      type: "init",
      region: { latitude: effectiveRegion?.latitude ?? 12.07, longitude: effectiveRegion?.longitude ?? 124.6, zoom },
      interactive: { scroll: scrollEnabled, zoom: zoomEnabled, rotate: rotateEnabled, pitch: pitchEnabled },
    });
  }, [effectiveRegion, zoom, sendToWebView, scrollEnabled, zoomEnabled, rotateEnabled, pitchEnabled]);

  const sendTiles = useCallback(() => {
    sendToWebView({ type: "tiles", url: tileUrl });
  }, [tileUrl, sendToWebView]);

  const sendMarkers = useCallback(() => {
    sendToWebView({ type: "markers", data: latestMarkerDataRef.current });
  }, [sendToWebView]);

  const sendPolylines = useCallback(() => {
    sendToWebView({ type: "polylines", data: polylineData });
  }, [polylineData, sendToWebView]);

  const sendMapState = useCallback(() => {
    sendInit();
    sendTiles();
    if (mapStyle) sendToWebView({ type: "setStyle", style: mapStyle });
    sendMarkers();
    sendPolylines();
    if (userLocation?.latitude != null && userLocation?.longitude != null) {
      sendToWebView({ type: "userLocation", latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
    if (focusRef.current?.latitude != null && focusRef.current?.longitude != null) {
      sendToWebView({ type: "focus", ...focusRef.current });
    }
  }, [sendInit, sendTiles, sendMarkers, sendPolylines, mapStyle, userLocation, sendToWebView]);

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
      if (msg.type === "markerCount") {
        markersConfirmedRef.current = (msg.count || 0) > 0;
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
    if (readyRef.current) sendInit();
  }, [sendInit]);

  useEffect(() => {
    if (readyRef.current) sendTiles();
  }, [sendTiles]);

  useEffect(() => {
    if (readyRef.current) sendMarkers();
  }, [markerDataSig, sendMarkers]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const tick = setInterval(() => {
      if (!readyRef.current) return;
      if (markersConfirmedRef.current) {
        clearInterval(tick);
        return;
      }
      sendMarkers();
      if (userLocation?.latitude != null && userLocation?.longitude != null) {
        sendToWebView({ type: "userLocation", latitude: userLocation.latitude, longitude: userLocation.longitude });
      }
    }, 1200);
    const stop = setTimeout(() => clearInterval(tick), 12000);
    return () => { clearInterval(tick); clearTimeout(stop); };
  }, [markerDataSig, sendMarkers, sendToWebView, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (readyRef.current) sendPolylines();
  }, [sendPolylines]);

  useEffect(() => {
    if (!readyRef.current || !effectiveRegion) return;
    if (mapStyle) sendToWebView({ type: "setStyle", style: mapStyle });
  }, [mapStyle, effectiveRegion, sendToWebView]);

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
        <iframe ref={iframeRef} src={mapServerUrl() || "about:blank"} style={{ width: "100%", height: "100%", border: 0 }} title="Map" />
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
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
      />
    </View>
  );
});

MapView.displayName = "MapView";

export { MapView as default, Marker, Polyline, UrlTile };