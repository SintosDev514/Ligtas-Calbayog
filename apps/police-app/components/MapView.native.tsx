import React, { useCallback, useRef, useEffect, useMemo, forwardRef } from "react";
import { View, Platform } from "react-native";

const MAPILLARY_TOKEN = "MLY|27240407492254490|a5c94f86b7fb9a1e9728f1eddcb49110";

const HTML = `
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
.marker{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;overflow:hidden}
.marker-img{width:100%;height:100%;border-radius:50%;object-fit:cover}
@keyframes emergency-pulse-1{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}100%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}
@keyframes emergency-pulse-2{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.35)}100%{box-shadow:0 0 0 26px rgba(239,68,68,0)}}
@keyframes emergency-glow{0%,100%{filter:drop-shadow(0 0 4px rgba(239,68,68,0.4))}50%{filter:drop-shadow(0 0 10px rgba(239,68,68,0.7))}}
@keyframes user-pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,0.5)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}
.marker-animate{animation:emergency-pulse-1 1.4s ease-out infinite,emergency-glow 2s ease-in-out infinite}
.user-location-animate{animation:user-pulse 2.5s infinite}
.mapboxgl-popup-content{font-size:12px;padding:8px 10px;border-radius:8px;font-family:sans-serif;max-width:220px}
.mapboxgl-popup-close-button{font-size:16px;padding:2px 6px}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
var TOKEN = '${MAPILLARY_TOKEN}';
var TILE_URL = 'https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=' + encodeURIComponent(TOKEN);

var STYLE_TILES = {
  light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  street: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
};

var currentStyle = 'light';

var STYLE_NAMES = ['light', 'dark', 'street'];
var STYLE_ATTR = {
  light: '© CARTO',
  dark: '© CARTO',
  street: '© OpenStreetMap'
};

var map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: Object.fromEntries(STYLE_NAMES.map(function(k) {
      return ['tiles-'+k, { type: 'raster', tiles: [STYLE_TILES[k]], tileSize: 256, attribution: STYLE_ATTR[k] }];
    })),
    layers: STYLE_NAMES.map(function(k) {
      return { id: 'tiles-'+k, type: 'raster', source: 'tiles-'+k, layout: { visibility: k === currentStyle ? 'visible' : 'none' } };
    })
  },
  attributionControl: true,
  center: [124.6, 12.07],
  zoom: 11,
  pitch: 0,
  bearing: 0,
  maxPitch: 85
});

var _initialPitch = null;
var _initialBearing = null;
var loaded = false;
var ready = false;
var pendingMarkers = [];

function setMapStyle(style) {
  currentStyle = style;
  STYLE_NAMES.forEach(function(s) {
    map.setLayoutProperty('tiles-' + s, 'visibility', s === style ? 'visible' : 'none');
  });
}

map.on('load', function() {
  loaded = true;
  if (_initialPitch != null) {
    map.setPitch(_initialPitch);
  }
  if (_initialBearing != null) {
    map.setBearing(_initialBearing);
  }

  map.addSource('mapillary', {
    type: 'vector',
    tiles: [TILE_URL],
    minzoom: 0,
    maxzoom: 14
  });

  map.addLayer({
    id: 'mly-overview',
    type: 'circle',
    source: 'mapillary',
    'source-layer': 'overview',
    minzoom: 0,
    maxzoom: 6,
    paint: {
      'circle-color': '#05CB63',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 5, 4],
      'circle-opacity': 0.75
    }
  });

  map.addLayer({
    id: 'mly-sequences',
    type: 'line',
    source: 'mapillary',
    'source-layer': 'sequence',
    minzoom: 6,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#05CB63',
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 3, 14, 2, 18, 3],
      'line-opacity': 0.8
    }
  });

  map.addLayer({
    id: 'mly-images',
    type: 'circle',
    source: 'mapillary',
    'source-layer': 'image',
    minzoom: 14,
    paint: {
      'circle-color': '#05CB63',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 9],
      'circle-opacity': 0.95,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': 0.7
    }
  });

  map.on('mouseenter', 'mly-sequences', function() { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'mly-sequences', function() { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'mly-images', function() { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'mly-images', function() { map.getCanvas().style.cursor = ''; });

  if (pendingMarkers.length) {
    doAddMarkers(pendingMarkers);
    pendingMarkers = [];
  }

  if (!ready) {
    ready = true;
    postMsg('ready', {});
  }
});

function clearRoute() {
  try {
    if (map.getSource('route')) {
      map.removeLayer('route-line');
      map.removeSource('route');
    }
  } catch(e) {}
}

function setRoute(data) {
  clearRoute();
  if (!data || !data.geometry) return;
  map.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: data.geometry }
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#EF4444',
      'line-width': 5,
      'line-opacity': 0.85
    }
  });
  var coords = data.geometry.coordinates;
  if (coords && coords.length > 0) {
    var bounds = coords.reduce(function(b, c) {
      return b.extend(c);
    }, new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1000 });
  }
}

function postMsg(type, data) {
  var msg = JSON.stringify({ type: type, data: data || {} });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(msg, '*');
  }
}

var markers = [];
var arrowEl = null;
var arrowMarker = null;

function updateArrowHeading(heading) {
  if (arrowEl && arrowEl.parentNode) {
    arrowEl.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));"><circle cx="15" cy="15" r="13" fill="rgba(59,130,246,0.25)" stroke="#3B82F6" stroke-width="2.5"/><g transform="rotate(' + heading + ', 15, 15)"><polygon points="15,3 21,22 15,17 9,22" fill="#3B82F6" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></g></svg>';
  }
}

function doAddMarkers(list) {
  markers.forEach(function(m) { m.remove(); });
  markers = [];

  list.forEach(function(m) {
    var isUserLoc = m.color === '#3B82F6' && !m.animate;
    var isCustom = !!m.markerHtml;
    var hasHeading = typeof m.heading === 'number' && !isNaN(m.heading);
    var isArrow = isUserLoc && hasHeading;
    var el = document.createElement('div');

    if (isArrow) {
      arrowEl = el;
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
      el.style.width = '26px';
      el.style.height = '26px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.style.overflow = 'hidden';
      el.style.background = 'rgba(0,0,0,0.6)';
      el.style.border = '2px solid rgba(251,191,36,0.6)';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
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
      el.style.background = m.animate ? '#EF4444' : (m.color || '#3B82F6');
      el.style.border = '2px solid ' + (m.animate ? '#FCA5A5' : '#fff');
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

    var popup = null;
    if (m.popupHtml) {
      popup = new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false, maxWidth: '300px' }).setHTML(m.popupHtml);
    } else if (m.title) {
      popup = new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false }).setText(m.title);
    }

    var marker = new maplibregl.Marker({ element: el })
      .setLngLat([m.longitude, m.latitude])
      .addTo(map);

    if (popup) marker.setPopup(popup);

    el.addEventListener('click', function() {
      postMsg('markerPress', { latitude: m.latitude, longitude: m.longitude });
    });

    markers.push(marker);
  });
}

function addMarkers(list) {
  if (!loaded) { pendingMarkers = list; return; }
  doAddMarkers(list);
}

map.on('click', function(e) {
  postMsg('mapPress', { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
});

function onRCMessage(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.type === 'init' && msg.region) {
      map.setCenter([msg.region.longitude, msg.region.latitude]);
      if (msg.region.zoom) map.setZoom(msg.region.zoom);
      if (msg.region.pitch != null) {
        if (loaded) { map.setPitch(msg.region.pitch); }
        else { _initialPitch = msg.region.pitch; }
      }
      if (msg.region.bearing != null) {
        if (loaded) { map.setBearing(msg.region.bearing); }
        else { _initialBearing = msg.region.bearing; }
      }
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
})();
<\/script>
</body>
</html>
`;

const MapView = forwardRef<any, any>(({ style, children, onMarkerPress, initialRegion, mapStyle = "light", routeData, pitch, bearing, userHeading, ...props }, ref) => {
  const webViewRef = useRef<any>(null);
  const readyRef = useRef(false);
  const onMarkerPressRef = useRef(onMarkerPress);
  const markersRef = useRef<any[]>([]);
  const webViewSource = useMemo(() => ({ html: HTML }), []);

  const extractMarkers = useCallback((children: any) => {
    const markers: any[] = [];
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === "Marker") {
        const { coordinate, pinColor, title, popupHtml, markerHtml, children: mc } = child.props;
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
        });
      }
    });
    return markers;
  }, []);

  const region = initialRegion || (props as any).region;
  const zoom = region
    ? Math.round(Math.log2(360 / Math.max(region.latitudeDelta || 0.05, 0.001)))
    : 11;
  const markers = extractMarkers(children);
  markersRef.current = markers;
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
        });
      }
    } catch {}
  }, [region, zoom, routeData, sendToWebView, pitch, bearing]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (markers.length > 0) {
      sendToWebView({ type: "markers", data: markers });
    }
  }, [markers, sendToWebView]);

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
