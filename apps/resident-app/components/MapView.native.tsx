import React, { useCallback, useRef, useEffect, forwardRef } from "react";
import { View, Platform } from "react-native";
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch (e) {
    console.warn("react-native-webview not available");
  }
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#F1F5F9}
#map{width:100%;height:100%}
.marker{width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:18px;color:#fff}
.marker-pulse::after{content:'';position:absolute;width:100%;height:100%;border-radius:50%;border:3px solid #22C55E;top:0;left:0;animation:pulse-ring 1.5s ease-out infinite;pointer-events:none}
@keyframes pulse-ring{0%{transform:scale(1);opacity:0.8}100%{transform:scale(1.8);opacity:0}}
.marker-img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.marker-icon{font-size:16px;line-height:1}
.maplibregl-popup-content{font-size:12px;padding:8px 10px;border-radius:8px;font-family:sans-serif;max-width:220px}
.maplibregl-popup-close-button{font-size:16px;padding:2px 6px}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
var map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] },
  center: [124.6, 12.07],
  zoom: 11,
  attributionControl: true
});

var loaded = false;
var ready = false;
var tileSourceId = null;
var currentTileUrl = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
var markers = [];

function postMsg(type, data) {
  var msg = JSON.stringify({ type: type, data: data || {} });
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
}

function updateTiles(url) {
  if (tileSourceId) {
    try { map.removeLayer(tileSourceId); } catch(e) {}
    try { map.removeSource(tileSourceId); } catch(e) {}
  }
  tileSourceId = 'tiles-' + Date.now();
  map.addSource(tileSourceId, { type: 'raster', tiles: [url], tileSize: 256 });
  map.addLayer({ id: tileSourceId, type: 'raster', source: tileSourceId });
  currentTileUrl = url;
}

function addPolylines(list) {
  list.forEach(function(p, i) {
    var sourceId = 'route-' + i;
    var layerId = 'route-layer-' + i;
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch(e) {}
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: p.coords } }
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': p.color || '#3B82F6', 'line-width': p.width || 3, 'line-opacity': 0.8 }
    });
  });
}

var ICON_SVGS = {
  pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
  warning: '<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  'post-pin': '<svg viewBox="0 0 24 24" width="28" height="28" fill="#fbbf24" stroke="#d97706" stroke-width="0.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>',
};

function doSetMarkers(list) {
  markers.forEach(function(m) { m.remove(); });
  markers = [];
  list.forEach(function(m) {
    var el = document.createElement('div');
    if (m.iconName === 'post-pin') {
      el.innerHTML = ICON_SVGS['post-pin'];
      el.style.cursor = 'pointer';
    } else {
      el.className = 'marker' + (m.animated ? ' marker-pulse' : '');
      el.style.background = m.color || '#3B82F6';
      if (m.imageUrl) {
        el.style.background = '#17202b';
        el.style.borderColor = '#22C55E';
        var img = document.createElement('img');
        img.className = 'marker-img';
        img.src = m.imageUrl;
        img.onerror = function() { this.parentElement.style.background = m.color || '#3B82F6'; this.remove(); };
        el.appendChild(img);
      } else {
        el.innerHTML = ICON_SVGS[m.iconName] || ICON_SVGS.pin;
      }
    }
    var marker = new maplibregl.Marker({ element: el }).setLngLat([m.longitude, m.latitude]).addTo(map);
    el.addEventListener('click', function() {
      postMsg('markerPress', { id: m.id, latitude: m.latitude, longitude: m.longitude });
    });
    markers.push(marker);
  });
}

map.on('load', function() {
  loaded = true;
  updateTiles(currentTileUrl);
  ready = true;
  postMsg('ready', {});
});

map.on('moveend', function() {
  var center = map.getCenter();
  var bounds = map.getBounds();
  postMsg('regionChange', {
    latitude: center.lat, longitude: center.lng,
    latitudeDelta: bounds.getNorthEast().lat - bounds.getSouthWest().lat,
    longitudeDelta: bounds.getNorthEast().lng - bounds.getSouthWest().lng
  });
});

map.on('click', function(e) {
  postMsg('mapPress', { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
});

function onRCMessage(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.type === 'init' && msg.region) {
      map.setCenter([msg.region.longitude, msg.region.latitude]);
      if (msg.region.zoom) map.setZoom(msg.region.zoom);
      if (msg.tileUrl) updateTiles(msg.tileUrl);
    }
    if (msg.type === 'setTileUrl') { updateTiles(msg.url); }
    if (msg.type === 'setMarkers') { doSetMarkers(msg.data || []); }
    if (msg.type === 'setPolylines') { addPolylines(msg.data || []); }
    if (msg.type === 'setZoom') { map.setZoom(msg.zoom); }
    if (msg.type === 'setCenter') { map.setCenter([msg.lng, msg.lat]); }
  } catch(err) {}
}
window.addEventListener('message', onRCMessage);
document.addEventListener('message', onRCMessage);
})();
<\/script>
</body>
</html>
`;

function findImageUri(children: any): string | null {
  let uri: string | null = null;
  React.Children.forEach(children, (child: any) => {
    if (uri) return;
    if (child?.props?.source?.uri) {
      uri = child.props.source.uri;
    } else if (child?.props?.children) {
      uri = findImageUri(child.props.children);
    }
  });
  return uri;
}

function extractMarkers(children: any) {
  const markers: any[] = [];
  let idCounter = 0;
  React.Children.forEach(children, (child: any) => {
    if (child?.type?.displayName === "Marker") {
      const { coordinate, pinColor, title, animated, iconName, children: mc } = child.props;
      const imageUrl = mc ? findImageUri(mc) : null;
      markers.push({
        id: idCounter++,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        color: pinColor || "#3B82F6",
        title: title || null,
        imageUrl,
        animated: !!animated,
        iconName: iconName || "pin",
      });
    }
  });
  return markers;
}

function extractPolylines(children: any) {
  const polylines: any[] = [];
  React.Children.forEach(children, (child: any) => {
    if (child?.type?.displayName === "Polyline") {
      const { coordinates, strokeColor, strokeWidth } = child.props;
      polylines.push({
        coords: (coordinates || []).map((c: any) => [c.longitude, c.latitude]),
        color: strokeColor || "#3B82F6",
        width: strokeWidth || 3,
      });
    }
  });
  return polylines;
}

function extractTileUrl(children: any): string | null {
  let url: string | null = null;
  React.Children.forEach(children, (child: any) => {
    if (child?.type?.displayName === "UrlTile" && child.props.urlTemplate) {
      url = child.props.urlTemplate;
    }
  });
  return url;
}

const MapView = forwardRef<any, any>(({ style, children, mapStyle, initialRegion, region, onMarkerPress, scrollEnabled = true, zoomEnabled = true, pointerEvents, ...props }: any, ref) => {
  const webViewRef = useRef<any>(null);
  const readyRef = useRef(false);

  const markers = extractMarkers(children, onMarkerPress);
  const polylines = extractPolylines(children);
  const tileUrl = extractTileUrl(children);

  const activeRegion = region || initialRegion;
  const zoom = activeRegion
    ? Math.round(Math.log2(360 / Math.max(activeRegion.latitudeDelta || 0.05, 0.001)))
    : 11;

  const sendToWebView = useCallback((msg: any) => {
    try {
      if (webViewRef.current?.postMessage) {
        webViewRef.current.postMessage(JSON.stringify(msg));
      }
    } catch {}
  }, []);

  const onMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ready" && !readyRef.current) {
        readyRef.current = true;
        const initMsg: any = { type: "init" };
        if (activeRegion) {
          initMsg.region = {
            latitude: activeRegion.latitude,
            longitude: activeRegion.longitude,
            zoom,
          };
        }
        if (tileUrl) initMsg.tileUrl = tileUrl;
        sendToWebView(initMsg);
        if (markers.length > 0) {
          sendToWebView({ type: "setMarkers", data: markers });
        }
        if (polylines.length > 0) {
          sendToWebView({ type: "setPolylines", data: polylines });
        }
      }
      if (msg.type === "markerPress") {
        onMarkerPress?.({
          coordinate: { latitude: msg.data.latitude, longitude: msg.data.longitude },
        });
      }
    } catch {}
  }, [activeRegion, zoom, tileUrl, markers, polylines, onMarkerPress, sendToWebView]);

  useEffect(() => {
    if (readyRef.current) {
      if (tileUrl) sendToWebView({ type: "setTileUrl", url: tileUrl });
      if (markers.length > 0) sendToWebView({ type: "setMarkers", data: markers });
    }
  }, [tileUrl, markers, sendToWebView]);

  useEffect(() => {
    if (readyRef.current && polylines.length > 0) {
      sendToWebView({ type: "setPolylines", data: polylines });
    }
  }, [polylines, sendToWebView]);

  useEffect(() => {
    if (readyRef.current && activeRegion) {
      sendToWebView({ type: "setCenter", lat: activeRegion.latitude, lng: activeRegion.longitude });
    }
  }, [activeRegion, sendToWebView]);

  if (Platform.OS === "web") {
    return (
      <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]}>
        <iframe
          srcDoc={MAP_HTML}
          style={{ width: "100%", height: "100%", border: 0 }}
          title="Map"
        />
      </View>
    );
  }

  const WV = WebView;
  
  if (!WV && Platform.OS !== "web") {
    return (
      <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <View>Map unavailable</View>
        </View>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]}>
      <WV
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
});

MapView.displayName = "MapView";

const Marker: React.FC<{ animated?: boolean; iconName?: string; pinColor?: string; title?: string }> = () => null;
Marker.displayName = "Marker";

const Polyline: React.FC<any> = () => null;
Polyline.displayName = "Polyline";

const UrlTile: React.FC<{ urlTemplate: string }> = () => null;
UrlTile.displayName = "UrlTile";

export default MapView;
export { Marker, Polyline, UrlTile };
