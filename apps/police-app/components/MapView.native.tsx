import React, { useCallback, useRef, useEffect, forwardRef } from "react";
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
.marker{width:32px;height:32px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;overflow:hidden}
.marker-img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.marker-animate{animation:marker-pulse 2s infinite}
@keyframes marker-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.7)}70%{box-shadow:0 0 0 18px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
.maplibregl-popup-content{font-size:12px;padding:8px 10px;border-radius:8px;font-family:sans-serif;max-width:220px}
.maplibregl-popup-close-button{font-size:16px;padding:2px 6px}
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
  maxPitch: 85
});

var _initialPitch = null;
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
function doAddMarkers(list) {
  markers.forEach(function(m) { m.remove(); });
  markers = [];

  list.forEach(function(m) {
    var el = document.createElement('div');
    el.className = 'marker' + (m.animate ? ' marker-animate' : '');
    el.style.background = m.color || '#3B82F6';
    el.style.border = '3px solid ' + (m.animate ? '#EF4444' : '#22C55E');

    if (m.imageUrl) {
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

window.addEventListener('message', function(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.type === 'init' && msg.region) {
      map.setCenter([msg.region.longitude, msg.region.latitude]);
      if (msg.region.zoom) map.setZoom(msg.region.zoom);
      if (msg.region.pitch != null) {
        if (loaded) { map.setPitch(msg.region.pitch); }
        else { _initialPitch = msg.region.pitch; }
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
  } catch(err) {}
});
})();
<\/script>
</body>
</html>
`;

const MapView = forwardRef<any, any>(({ style, children, onMarkerPress, initialRegion, mapStyle = "light", routeData, ...props }, ref) => {
  const webViewRef = useRef<any>(null);
  const readyRef = useRef(false);

  const extractMarkers = useCallback((children: any) => {
    const markers: any[] = [];
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === "Marker") {
        const { coordinate, pinColor, title, popupHtml, children: mc } = child.props;
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
          imageUrl,
          animate: !!child.props.animate,
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
        const pitch = (props as any).pitch;
        if (region) {
          sendToWebView({ type: "init", region: { latitude: region.latitude, longitude: region.longitude, zoom, pitch } });
        }
        if (markers.length > 0) {
          sendToWebView({ type: "markers", data: markers });
        }
        if (routeData) {
          sendToWebView({ type: "route", route: routeData });
        }
      }
      if (msg.type === "markerPress") {
        onMarkerPress?.({
          coordinate: {
            latitude: msg.data.latitude,
            longitude: msg.data.longitude,
          },
        });
      }
    } catch {}
  }, [region, zoom, markers, routeData, onMarkerPress, sendToWebView]);

  useEffect(() => {
    if (readyRef.current && markers.length > 0) {
      sendToWebView({ type: "markers", data: markers });
    }
  }, [markers, sendToWebView]);

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
        source={{ html: HTML }}
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
