import React, { useCallback, useRef, useEffect, useMemo, forwardRef } from "react";
import { View, Platform } from "react-native";

const HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<link href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" rel="stylesheet" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#F1F5F9}
#map{width:100%;height:100%}
.leaflet-div-icon{background:transparent;border:none}
.leaflet-popup-content-wrapper{border-radius:8px;font-size:12px;font-family:sans-serif}
.leaflet-popup-content{margin:8px 10px;max-width:220px}
.leaflet-popup-close-button{font-size:16px;padding:2px 6px}
.marker{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;overflow:hidden}
.marker-img{width:100%;height:100%;border-radius:50%;object-fit:cover}
@keyframes emergency-pulse-1{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}100%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}
@keyframes emergency-pulse-2{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.35)}100%{box-shadow:0 0 0 26px rgba(239,68,68,0)}}
@keyframes emergency-glow{0%,100%{filter:drop-shadow(0 0 4px rgba(239,68,68,0.4))}50%{filter:drop-shadow(0 0 10px rgba(239,68,68,0.7))}}
@keyframes user-pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,0.5)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}
.marker-animate{animation:emergency-pulse-1 1.4s ease-out infinite,emergency-glow 2s ease-in-out infinite}
.marker-animate::after{content:'';position:absolute;top:-2px;left:-2px;right:-2px;bottom:-2px;border-radius:50%;animation:emergency-pulse-2 1.4s ease-out infinite;pointer-events:none}
.user-location-animate{animation:user-pulse 2.5s infinite}
.report-dot{width:15px;height:15px;border-radius:50%;background:var(--pc);border:2px solid #fff;cursor:pointer;position:relative;overflow:visible;animation:report-pulse 1.6s ease-out infinite}
@keyframes report-pulse{0%{box-shadow:0 0 0 0 var(--pulse-1)}70%{box-shadow:0 0 0 15px var(--pulse-2)}100%{box-shadow:0 0 0 0 var(--pulse-2)}}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
var STYLE_TILES = {
  light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  street: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
};
var STYLE_ATTR = {
  light: '© CARTO',
  dark: '© CARTO',
  street: '© OpenStreetMap'
};
var currentStyle = 'street';

var map = L.map('map', {
  center: [12.07, 124.6],
  zoom: 11,
  minZoom: 1,
  maxZoom: 19,
  attributionControl: true,
  zoomControl: false,
  scrollWheelZoom: true,
  dragging: true
});

var tileLayer = null;
function setMapStyle(style) {
  currentStyle = style;
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(STYLE_TILES[style] || STYLE_TILES.light, {
    attribution: STYLE_ATTR[style] || STYLE_ATTR.light,
    maxZoom: 19
  }).addTo(map);
}
setMapStyle('street');

var loaded = false;
var ready = false;
var pendingMarkers = [];

window.addEventListener('resize', function() { map.invalidateSize(); });
if (typeof ResizeObserver !== 'undefined') {
  var ro = new ResizeObserver(function() { map.invalidateSize(); });
  ro.observe(document.getElementById('map'));
}
map.on('moveend', function() { map.invalidateSize(); });
setTimeout(function() { try { map.invalidateSize(); } catch(e) {} }, 300);
setTimeout(function() { try { map.invalidateSize(); } catch(e) {} }, 1200);

loaded = true;

function postMsg(type, data) {
  var msg = JSON.stringify({ type: type, data: data || {} });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(msg, '*');
  }
}

var markerLayer = L.layerGroup().addTo(map);
var clusterLayer = L.layerGroup().addTo(map);
var routeLayer = null;
var markers = [];
var arrowMarker = null;

function updateArrowHeading(heading) {
  if (!arrowMarker) return;
  var el = arrowMarker.getElement();
  if (!el) return;
  var svg = el.querySelector('svg');
  var g = svg && svg.querySelector('g');
  if (g) g.setAttribute('transform', 'rotate(' + heading + ', 15, 15)');
}

function doAddMarkers(list) {
  markerLayer.clearLayers();
  clusterLayer.clearLayers();
  markers = [];
  arrowMarker = null;

  var clusterable = [];
  var regular = [];

  list.forEach(function(m) {
    if (m.clusterGroup) {
      clusterable.push(m);
      return;
    }
    regular.push(m);
  });

  regular.forEach(function(m) {
    var isUserLoc = m.color === '#3B82F6' && !m.animate;
    var isCustom = !!m.markerHtml;
    var hasHeading = typeof m.heading === 'number' && !isNaN(m.heading);
    var isArrow = isUserLoc && hasHeading;
    var el = document.createElement('div');

    if (isArrow) {
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));"><circle cx="15" cy="15" r="13" fill="rgba(59,130,246,0.25)" stroke="#3B82F6" stroke-width="2.5"/><g transform="rotate(' + m.heading + ', 15, 15)"><polygon points="15,3 21,22 15,17 9,22" fill="#3B82F6" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></g></svg>';
      el.classList.add('user-location-animate');
    } else if (isCustom) {
      el.style.position = 'relative';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.cursor = 'pointer';
      el.style.overflow = 'visible';
      el.innerHTML = m.markerHtml;
    } else {
      el.style.position = 'relative';
      el.style.width = isUserLoc ? '18px' : '26px';
      el.style.height = isUserLoc ? '18px' : '26px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.style.overflow = 'visible';
      el.className = 'marker' + (m.animate ? ' marker-animate' : '') + (isUserLoc ? ' user-location-animate' : '');
      el.style.background = m.color || '#3B82F6';
      el.style.border = '2px solid #fff';
      el.style.boxShadow = isUserLoc
        ? '0 1px 4px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(59,130,246,0.3)'
        : '0 2px 8px rgba(0,0,0,0.35)';
    }

    if (!isArrow && !isCustom && m.imageUrl) {
      el.style.background = '#fff';
      var img = document.createElement('img');
      img.className = 'marker-img';
      img.src = m.imageUrl;
      img.onerror = function() { this.parentElement.style.background = m.color || '#3B82F6'; this.remove(); };
      el.appendChild(img);
    }

    var size = isArrow ? 30 : (isCustom ? 30 : (isUserLoc ? 18 : 26));
    var anchor = isArrow ? 15 : (isCustom ? 15 : (isUserLoc ? 9 : 13));
    var icon = L.divIcon({
      html: el.outerHTML,
      className: 'leaflet-div-icon',
      iconSize: [size, size],
      iconAnchor: [anchor, anchor]
    });

    var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(markerLayer);

    if (isArrow) arrowMarker = marker;

    if (m.popupHtml) {
      marker.bindPopup(m.popupHtml, { offset: [0, -13], maxWidth: '300px', closeButton: true, autoClose: false, closeOnClick: false });
    } else if (m.title) {
      marker.bindPopup(m.title, { offset: [0, -13] });
    }

    marker.on('click', function() {
      postMsg('markerPress', { latitude: m.latitude, longitude: m.longitude });
    });

    markers.push(marker);
  });

  syncClusters(clusterable);
}

function hexToRgba(hex, alpha) {
  var h = hex.replace('#','');
  if (h.length === 3) h = h.split('').map(function(c){return c+c;}).join('');
  var n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

function syncClusters(list) {
  (list || []).forEach(function(m) {
    var color = m.color || '#f59e0b';
    var el = document.createElement('div');
    el.className = 'report-dot';
    el.style.background = color;
    el.style.setProperty('--pc', color);
    el.style.setProperty('--pulse-1', hexToRgba(color, 0.5));
    el.style.setProperty('--pulse-2', hexToRgba(color, 0));
    var icon = L.divIcon({ html: el.outerHTML, className: 'leaflet-div-icon', iconSize: [15, 15], iconAnchor: [7.5, 7.5] });
    var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(clusterLayer);
    if (m.title) marker.bindPopup(m.title, { offset: [0, -8] });
    marker.on('click', function() {
      postMsg('markerPress', { latitude: m.latitude, longitude: m.longitude, id: m.id || null, title: m.title || null });
    });
  });
}

function clearRoute() {
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

function setRoute(data) {
  clearRoute();
  if (!data || !data.geometry) return;
  var coords = data.geometry.coordinates;
  var latlngs = coords.map(function(c) { return [c[1], c[0]]; });
  if (!latlngs.length) return;

  routeLayer = L.polyline(latlngs, {
    color: '#EF4444',
    weight: 5,
    opacity: 0.85,
    lineJoin: 'round',
    lineCap: 'round'
  }).addTo(map);
}

function addMarkers(list) {
  if (!loaded) { pendingMarkers = list; return; }
  doAddMarkers(list);
}

map.on('click', function(e) {
  postMsg('mapPress', { latitude: e.latlng.lat, longitude: e.latlng.lng });
});

function onRCMessage(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.type === 'init' && msg.region) {
      map.setView([msg.region.latitude, msg.region.longitude], msg.region.zoom, { animate: true });
    }
    if (msg.type === 'markers') {
      addMarkers(msg.data || []);
    }
    if (msg.type === 'setStyle') {
      setMapStyle(msg.style);
    }
    if (msg.type === 'route') {
      setRoute(msg.route);
    }
    if (msg.type === 'clearRoute') {
      clearRoute();
    }
    if (msg.type === 'updateHeading') {
      updateArrowHeading(msg.heading);
    }
  } catch(err) {}
}
window.addEventListener('message', onRCMessage);
document.addEventListener('message', onRCMessage);

postMsg('ready', {});
})();
<\/script>
</body>
</html>
`;

const MapView = forwardRef<any, any>(({ style, children, onMarkerPress, initialRegion, mapStyle = "street", routeData, pitch, bearing, userHeading, ...props }, ref) => {
  const webViewRef = useRef<any>(null);
  const readyRef = useRef(false);
  const onMarkerPressRef = useRef(onMarkerPress);
  const markersRef = useRef<any[]>([]);
  const webViewSource = useMemo(() => ({ html: HTML }), []);

  const extractMarkers = useCallback((children: any) => {
    const markers: any[] = [];
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === "Marker") {
        const { coordinate, pinColor, title, popupHtml, markerHtml, clusterGroup, id, children: mc } = child.props;
        let imageUrl = null;
        if (mc) {
          const arr = React.Children.toArray(mc);
          const firstChild = arr[0] as any;
          if (firstChild?.props?.source?.uri) {
            imageUrl = firstChild.props.source.uri;
          }
        }
        markers.push({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          color: pinColor || "#3B82F6",
          title: title || null,
          popupHtml: popupHtml || null,
          markerHtml: markerHtml || null,
          imageUrl,
          animate: !!child.props.animate,
          heading: typeof child.props.heading === "number" ? child.props.heading : null,
          clusterGroup: clusterGroup || null,
          id: id || null,
        });
      }
    });
    return markers;
  }, []);

  const region = initialRegion || (props as any).region;
  const zoom = region
    ? Math.round(Math.log2(360 / Math.max(region.latitudeDelta || 0.05, 0.001)))
    : 11;
  const markers = useMemo(() => {
    const list = extractMarkers(children);
    return {
      list,
      sig: JSON.stringify(
        list.map((m: any) =>
          [
            m.latitude,
            m.longitude,
            m.color,
            m.title || "",
            m.animate ? 1 : 0,
            m.clusterGroup || "",
            m.id || "",
            m.popupHtml ? 1 : 0,
            m.markerHtml ? 1 : 0,
          ].join("|"),
        ),
      ),
    };
  }, [children, extractMarkers]);
  markersRef.current = markers.list;
  onMarkerPressRef.current = onMarkerPress;

  const sendToWebView = useCallback((msg: any) => {
    try {
      const data = JSON.stringify(msg);
      if (webViewRef.current?.postMessage) {
        webViewRef.current.postMessage(data);
      }
    } catch {}
  }, []);

  const onMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ready" && !readyRef.current) {
        readyRef.current = true;
        if (region) {
          sendToWebView({ type: "init", region: { latitude: region.latitude, longitude: region.longitude, zoom, pitch: pitch ?? 0, bearing: bearing ?? 0 } });
        }
        if (markersRef.current.length > 0) {
          sendToWebView({ type: "markers", data: markersRef.current });
        }
        if (routeData) {
          sendToWebView({ type: "route", route: routeData });
        }
      }
      if (msg.type === "markerPress") {
        onMarkerPressRef.current?.({
          coordinate: {
            latitude: msg.data.latitude,
            longitude: msg.data.longitude,
          },
          id: msg.data.id || undefined,
          title: msg.data.title || undefined,
        });
      }
    } catch {}
  }, [region, zoom, routeData, sendToWebView, pitch, bearing]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (markers.list.length > 0) {
      sendToWebView({ type: "markers", data: markers.list });
    }
  }, [markers.sig, sendToWebView]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (region) {
      sendToWebView({ type: "init", region: { latitude: region.latitude, longitude: region.longitude, zoom, pitch: pitch ?? 0, bearing: bearing ?? 0 } });
    }
  }, [region?.latitude, region?.longitude, zoom, sendToWebView, pitch, bearing]);

  useEffect(() => {
    if (readyRef.current) {
      sendToWebView({ type: "setStyle", style: mapStyle });
    }
  }, [mapStyle, sendToWebView]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (routeData) {
      sendToWebView({ type: "route", route: routeData });
    } else {
      sendToWebView({ type: "clearRoute" });
    }
  }, [routeData, sendToWebView]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (typeof userHeading === "number") {
      sendToWebView({ type: "updateHeading", heading: userHeading });
    }
  }, [userHeading, sendToWebView]);

  if (Platform.OS === "web") {
    return (
      <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]}>
        <iframe
          srcDoc={HTML}
          style={{ width: "100%", height: "100%", border: 0 }}
          title="Map"
        />
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#F1F5F9" }, style]}>
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
      />
    </View>
  );
});

MapView.displayName = "MapView";

const Marker: React.FC<any> = () => null;
Marker.displayName = "Marker";

export default MapView;
export { Marker };