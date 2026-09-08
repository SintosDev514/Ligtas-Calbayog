
window.onerror = function(m, src, line, col) {
  try { var el = document.getElementById('mb-status'); if (el) el.textContent = 'SCRIPT ERROR: ' + m + ' (line ' + line + ')'; } catch(e) {}
};
(function(){
function mbStatus(msg) {
  var el = document.getElementById('mb-status');
  if (el) el.textContent = msg;
}
mbStatus('Loading map engine... (v7 script is running)');

function loadEngine(done) {
  var srcs = [
    'https://api.mapbox.com/mapbox-gl-js/v3.26.0/mapbox-gl.js',
    'https://unpkg.com/mapbox-gl@3.26.0/dist/mapbox-gl.js',
    'https://unpkg.com/mapbox-gl@2.15.0/dist/mapbox-gl.js'
  ];
  var i = 0;
  var busy = false;
  function ready() { return !!window.mapboxgl; }
  function step() {
    if (ready()) { done(); return; }
    if (busy) return;
    if (i < srcs.length) {
      var s = document.createElement('script');
      s.src = srcs[i++];
      var finished = false;
      function next() { if (finished) return; finished = true; busy = false; setTimeout(step, 0); }
      s.onload = function() { if (ready()) { busy = false; done(); return; } next(); };
      s.onerror = function() { next(); };
      busy = true;
      document.head.appendChild(s);
      setTimeout(function() { if (ready()) { busy = false; done(); return; } next(); }, 5000);
    } else {
      mbStatus('Map engine (Mapbox GL) could not load on this device. Check that api.mapbox.com / unpkg.com are reachable from this device\'s internet connection.');
    }
  }
  setTimeout(step, 0);
}
loadEngine(function() {
function startMap() {
var hasGL = (function() {
  try {
    var cv = document.createElement('canvas');
    return !!(cv.getContext('webgl') || cv.getContext('experimental-webgl'));
  } catch(e) { return false; }
})();
if (!hasGL) {
  mbStatus('WebGL is not available in this browser/WebView, so the Mapbox map cannot draw.');
  return;
}
var OSM_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

var STYLE_MAP = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN || new URLSearchParams(location.search).get('token') || '';

function attributionFor(url) {
  if (url.indexOf('cartocdn') > -1) return '&copy; CARTO';
  if (url.indexOf('arcgis') > -1 || url.indexOf('ArcGIS') > -1) return '&copy; Esri';
  return '&copy; OpenStreetMap';
}

function makeStyle(url) {
  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles: [url], tileSize: 256, attribution: attributionFor(url), maxzoom: 19 }
    },
    layers: [
      { id: 'basemap-layer', type: 'raster', source: 'basemap' }
    ]
  };
}

var map;
try {
  map = new mapboxgl.Map({
    container: 'map',
    style: STYLE_MAP.satellite,
    center: [124.6, 12.07],
    zoom: 11,
    minZoom: 1,
    maxZoom: 19,
    attributionControl: false,
    renderWorldCopies: false,
    pitchWithRotate: false
  });
  window.__map = map;
} catch(e) {
  mbStatus('Map failed to start: ' + (e && e.message ? e.message : 'unknown error'));
  return;
}

var started = false;
var watchdog = null;
function watchStyle() {
  if (started) return;
  clearTimeout(watchdog);
  watchdog = setTimeout(function() {
    var ok = false;
    try { ok = !!(map.isStyleLoaded && map.isStyleLoaded()); } catch(e) {}
    if (ok) { hideStatus(); return; }
    try { map.setStyle(makeStyle(OSM_FALLBACK)); } catch(e) {}
    hideStatus();
  }, 8000);
}
function hideStatus() {
  started = true;
  clearTimeout(watchdog);
  var el = document.getElementById('mb-status');
  if (el) el.style.display = 'none';
}
watchStyle();
map.once('load', hideStatus);
map.once('idle', hideStatus);
map.on('error', function(e) {
  if (started) return;
  var msg = (e && e.error && e.error.message) || '';
  if (!msg && e && e.error && e.error.status) msg = 'HTTP ' + e.error.status;
  mbStatus(msg ? ('Map error: ' + msg) : 'Map error: style/tiles failed to load');
});

var styleEverLoaded = false;
map.on('style.load', function() {
  styleEverLoaded = true;
  layersEnsured = false;
  defBallLoaded = false;
  canvasLoadActive = false;
  markNeed = 0;
  markReadyCount = 0;
  canvasDirty = false;
  try { ensureDefBall(); } catch(e) {}
  try { ensureCanvasLayers(); } catch(e) {}
  try { setPolylines(currentPolylines); } catch(e) {}
  try { loadCanvasMarkers(); } catch(e) {}
});

(function addCredit() {
  try {
    var c = document.createElement('div');
    c.className = 'mb-credit';
    c.textContent = '© OpenStreetMap';
    document.body.appendChild(c);
  } catch(e) {}
})();

var mapReady = false;
var pendingMsgs = [];

function postMsg(type, data) {
  var msg = JSON.stringify({ type: type, data: data || {} });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(msg, '*');
  }
}

function iconSVG(iconName) {
  var c = '#fff';
  if (iconName === 'post-pin') {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + c + '"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  }
  if (iconName === 'warning') {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><circle cx="12" cy="15.5" r="0.4" fill="' + c + '"/><line x1="12" y1="9" x2="12" y2="14"/></svg>';
  }
  if (iconName === 'shield') {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round"><path d="M12 2 4 5.5V11c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5.5L12 2z"/></svg>';
  }
  if (iconName === 'person' || iconName === 'location') {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + c + '"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  }
  return '';
}

function esc(s) {
  return (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pinHTML(m) {
  var bg = m.animated ? '#EF4444' : (m.color || '#EF4444');
  var ico = iconSVG(m.iconName || 'post-pin') ||
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + '#fff' + '"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  return '<div class="pin ' + (m.animated ? 'pin-animate' : '') + '" style="color:' + bg + '">' +
    '<div class="pin-head">' + ico + '</div>' +
    '<div class="pin-point"></div>' +
    '</div>';
}

function markerHTML(m) {
  var bg = m.animated ? '#EF4444' : (m.color || '#3B82F6');
  var cls = 'marker' + (m.animated ? ' marker-animate' : '');
  if (m.imageUrl) {
    return '<div class="img-marker">' +
      (m.animated ? '<div class="img-pulse"></div>' : '') +
      '<div class="marker-img-wrap">' +
        '<img class="marker-img" src="' + esc(m.imageUrl) + '" onerror="this.parentNode.style.background=\'#EF4444\'"/>' +
      '</div>' +
    '</div>';
  }
  if (m.iconName && m.iconName !== 'shield') {
    return pinHTML(m);
  }
  var ico = iconSVG(m.iconName || '');
  return '<div class="' + cls + '" style="background:' + bg + (m.animated ? '' : ';border-color:#fff') + '">' + ico + '</div>';
}

function markerElement(m) {
  var el = document.createElement('div');
  if (m.iconName && m.iconName !== 'shield') {
    el.style.position = 'relative';
    el.style.cursor = 'pointer';
    el.style.lineHeight = '0';
    el.innerHTML = markerHTML(m);
    return el;
  }
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.cursor = 'pointer';
  el.style.overflow = m.imageUrl ? 'visible' : 'visible';
  el.innerHTML = markerHTML(m);
  return el;
}

function setBaseTiles(url) {
  if (!url) url = OSM_FALLBACK;
  try { map.setStyle(makeStyle(url)); } catch(e) {}
  watchStyle();
}

function applyStyle(key) {
  if (!STYLE_MAP[key]) return;
  try { map.setStyle(STYLE_MAP[key]); } catch(e) {}
  watchStyle();
}

function markerAnchor(m) {
  if (m.iconName === 'post-pin' || m.iconName === 'warning' || m.iconName === 'person' || m.iconName === 'location') {
    return 'bottom';
  }
  return 'center';
}

var MBGL3 = !!(mapboxgl.version && parseInt(mapboxgl.version.split('.')[0], 10) >= 3);
var dragMarkers = [];
var activeMarkers = [];
var markNeed = 0;
var markReadyCount = 0;
var layersEnsured = false;

function svgDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function loadSVGImage(svg, cb) {
  var im = new Image();
  im.onload = function() { cb(im); };
  im.onerror = function() { cb(null); };
  im.src = svgDataUrl(svg);
}

function alreadyExistsError(e) {
  return !!(e && e.message && /already exists/i.test(e.message));
}

function safeAddImage(name, img, opts) {
  try {
    if (map.hasImage(name)) return true;
    map.addImage(name, img, opts);
    return true;
  } catch(e) {
    return alreadyExistsError(e);
  }
}

function pinSVG(color) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="92" viewBox="0 0 32 46">' +
    '<path d="M16 45C10.5 31.5 2.8 23.5 2.8 15.8A13.2 13.2 0 0 1 29.2 15.8C29.2 23.5 21.5 31.5 16 45Z" fill="' + color + '" stroke="#FFFFFF" stroke-width="2.6"/>' +
    '<circle cx="16" cy="15.6" r="6.8" fill="#FFFFFF"/>' +
    '<circle cx="16" cy="13" r="2.4" fill="#1e293b"/>' +
    '<path d="M12.6 19.8C12.6 16.6 19.4 16.6 19.4 19.8L19.4 21.2L12.6 21.2Z" fill="#1e293b"/>' +
    '</svg>';
}

function ballSVG(color, glyph) {
  var g = '';
  if (glyph === 'shield') {
    g = '<path d="M16 6.5 9.5 9v5.6c0 4.3 2.8 7.6 6.5 9.6 3.7-2 6.5-5.3 6.5-9.6V9L16 6.5zm0 3.3 4.2 1.6.3 4h-4.5V20h-2.4v-4.6H9.1l.3-4L16 9.8z" fill="#FFFFFF"/>';
  }
  if (glyph === 'person') {
    g = '<circle cx="16" cy="12.2" r="3.6" fill="#FFFFFF"/>' +
      '<path d="M16 17.5c-4.4 0-7 2.6-7 5.4v1h14v-1c0-2.8-2.6-5.4-7-5.4z" fill="#FFFFFF"/>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="15" fill="' + color + '" stroke="#FFFFFF" stroke-width="2.2"/>' +
    g +
    (glyph ? '' : '<circle cx="16" cy="16" r="4" fill="rgba(255,255,255,0.92)"/>') +
    '</svg>';
}

var pulseSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 48">' +
  '<circle cx="24" cy="24" r="22" fill="none" stroke="#EF4444" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="5 6"/>' +
  '</svg>';

function paintAvatar(name, url, cb) {
  var fallback = function() {
    loadSVGImage(ballSVG('#EF4444', 'person'), function(im) {
      if (im) {
        cb(safeAddImage(name, im, { pixelRatio: 2 }));
      } else {
        cb(false);
      }
    });
  };
  var im = new Image();
  im.crossOrigin = 'anonymous';
  var settled = false;
  im.onload = function() {
    if (settled) return;
    settled = true;
    try {
      var s = 88;
      var c = document.createElement('canvas');
      c.width = s; c.height = s;
      var x = c.getContext('2d');
      var R = s / 2;
      x.save();
      x.beginPath(); x.arc(R, R, R, 0, Math.PI * 2); x.clip();
      var k = Math.max(s / im.width, s / im.height);
      var w = im.width * k, h = im.height * k;
      x.drawImage(im, (s - w) / 2, (s - h) / 2, w, h);
      x.restore();
      x.beginPath(); x.arc(R, R, R - 1.5, 0, Math.PI * 2);
      x.strokeStyle = '#FFFFFF'; x.lineWidth = 6; x.stroke();
      if (safeAddImage(name, x.getImageData(0, 0, s, s), { pixelRatio: 2 })) {
        cb(true);
      } else {
        fallback();
      }
    } catch(e) {
      fallback();
    }
  };
  im.onerror = function() {
    if (settled) return;
    settled = true;
    fallback();
  };
  im.src = url;
}

function markerIconName(m) {
  var key;
  if (m.imageUrl) key = 'img_' + m.imageUrl;
  else if (m.iconName === 'post-pin' || m.iconName === 'warning' || m.iconName === 'person' || m.iconName === 'location')
    key = 'pin_' + (m.animated ? '#EF4444' : (m.color || '#EF4444'));
  else if (m.iconName === 'shield')
    key = 'ball_' + (m.color || '#3B82F6') + '_shield';
  else
    key = 'ball_' + (m.color || '#3B82F6');
  return 'm_' + key.replace(/[^A-Za-z0-9_.]/g, '_');
}

function ensureMarkerIcon(m, cb) {
  var name = markerIconName(m);
  try {
    if (map.hasImage(name)) { m._icon = name; cb(true); return; }
  } catch(e) {}
  var finish = function(ok) { if (ok) { m._icon = name; } else { m._icon = 'm_ball__EF4444'; } cb(ok); };
  try {
    if (m.imageUrl) {
      paintAvatar(name, m.imageUrl, finish);
      return;
    }
    var svg;
    if (m.iconName === 'post-pin' || m.iconName === 'warning' || m.iconName === 'person' || m.iconName === 'location') {
      svg = pinSVG(m.animated ? '#EF4444' : (m.color || '#EF4444'));
    } else if (m.iconName === 'shield') {
      svg = ballSVG(m.color || '#3B82F6', 'shield');
    } else {
      svg = ballSVG(m.color || '#3B82F6', null);
    }
    loadSVGImage(svg, function(im) {
      if (im) {
        finish(safeAddImage(name, im, { pixelRatio: 2 }));
      } else {
        finish(false);
      }
    });
  } catch(e) { finish(false); }
}

var defBallLoaded = false;
function ensureDefBall() {
  if (defBallLoaded) return;
  if (map.hasImage && map.hasImage('m_ball__EF4444')) { defBallLoaded = true; return; }
  try {
    loadSVGImage(ballSVG('#EF4444', null), function(im) {
      if (im) {
        defBallLoaded = true;
        safeAddImage('m_ball__EF4444', im, { pixelRatio: 2 });
        applyMarkers();
      }
    });
  } catch(e) {}
}

function ensureCanvasLayers() {
  ensureDefBall();
  try {
    if (!map.hasImage('m_pulse')) {
      loadSVGImage(pulseSVG, function(im) { if (im) safeAddImage('m_pulse', im, { pixelRatio: 2 }); });
    }
  } catch(e) {}
  if (!map.getSource('mark-src')) {
    try { map.addSource('mark-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); } catch(e) {}
  }
  if (layersEnsured) return;
  var overlap = MBGL3 ? { 'icon-overlap': 'always' } : { 'icon-allow-overlap': true };
  if (!map.getLayer('mark-layer')) {
    try {
      map.addLayer({
        id: 'mark-layer', type: 'symbol', source: 'mark-src',
        layout: Object.assign({}, overlap, {
          'icon-image': ['get', 'icon'],
          'icon-anchor': ['get', 'anchor'],
          'icon-ignore-placement': true,
          'icon-optional': true
        }),
        paint: { 'icon-opacity': 1 }
      });
    } catch(e) {}
  }
  if (MBGL3 && !map.getLayer('mark-pulse')) {
    try {
      map.addLayer({
        id: 'mark-pulse', type: 'symbol', source: 'mark-src',
        filter: ['==', ['get', 'animated'], true],
        layout: Object.assign({}, overlap, {
          'icon-image': 'm_pulse',
          'icon-anchor': 'center',
          'icon-ignore-placement': true,
          'icon-optional': true
        }),
        paint: {
          'icon-size': ['interpolate', ['linear'], ['get', 'pu'], 0, 0.5, 1, 1.9],
          'icon-opacity': ['interpolate', ['linear'], ['get', 'pu'], 0, 0.7, 1, 0.05]
        }
      });
    } catch(e) {}
  }
  layersEnsured = true;
  registerLayerEvents();
}

var eventsRegistered = false;
function registerLayerEvents() {
  if (eventsRegistered) return;
  eventsRegistered = true;
  map.on('click', 'mark-layer', function(e) {
    if (!e.features || !e.features.length) return;
    var p = e.features[0].properties;
    if (p.title) {
      try {
        new mapboxgl.Popup({ closeButton: true, maxWidth: '240px' })
          .setLngLat(e.lngLat).setHTML('<b>' + esc(p.title) + '</b>').addTo(map);
      } catch(e2) {}
    }
    postMsg('markerPress', { latitude: p.lat, longitude: p.lng });
  });
  try { map.on('mouseenter', 'mark-layer', function() { map.getCanvas().style.cursor = 'pointer'; }); } catch(e) {}
  try { map.on('mouseleave', 'mark-layer', function() { map.getCanvas().style.cursor = ''; }); } catch(e) {}
}

function anyAnimated() {
  for (var i = 0; i < activeMarkers.length; i++) {
    if (activeMarkers[i].animated) return true;
  }
  return false;
}

var pulseAnimId = null;
function updatePulseLoop() {
  var need = anyAnimated();
  if (need && !pulseAnimId) {
    pulseAnimId = requestAnimationFrame(pulseFrame);
  } else if (!need && pulseAnimId) {
    cancelAnimationFrame(pulseAnimId);
    pulseAnimId = null;
  }
}

function pulseFrame(ts) {
  var src = null;
  try { src = map.getSource('mark-src'); } catch(e) {}
  if (src) {
    try {
      var d = src._data;
      if (d && d.features && d.features.length) {
        var t = (ts % 2800) / 2800;
        d.features.forEach(function(f) {
          if (f.properties.animated) f.properties.pu = t;
        });
        src.setData(d);
      }
    } catch(e) {}
  }
  if (anyAnimated()) {
    pulseAnimId = requestAnimationFrame(pulseFrame);
  } else {
    pulseAnimId = null;
  }
}

function applyMarkers() {
  try {
    ensureCanvasLayers();
    if (!map.getSource('mark-src')) return;
    var feats = activeMarkers.map(function(m) {
      return {
        type: 'Feature',
        properties: {
          icon: m._icon || 'm_ball__EF4444',
          anchor: (m.iconName === 'post-pin' || m.iconName === 'warning' || m.iconName === 'person' || m.iconName === 'location') ? 'bottom' : 'center',
          lat: m.latitude, lng: m.longitude,
          title: m.title || '',
          animated: !!m.animated,
          pu: 0
        },
        geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] }
      };
    });
    map.getSource('mark-src').setData({ type: 'FeatureCollection', features: feats });
    updatePulseLoop();
    window.__markerCount = feats.length;
  } catch(e) {}
}

var canvasLoadActive = false;
var canvasDirty = false;
function markOneDone() {
  markReadyCount++;
  if (markReadyCount >= markNeed) {
    canvasLoadActive = false;
    var again = canvasDirty;
    canvasDirty = false;
    applyMarkers();
    if (again) loadCanvasMarkers();
  }
}

function loadCanvasMarkers() {
  if (!map) return;
  if (canvasLoadActive) { canvasDirty = true; return; }
  if (!styleEverLoaded) { setTimeout(loadCanvasMarkers, 300); return; }
  canvasLoadActive = true;
  ensureDefBall();
  if (!activeMarkers.length) {
    applyMarkers();
    canvasLoadActive = false;
    if (canvasDirty) { canvasDirty = false; loadCanvasMarkers(); }
    return;
  }
  markNeed = activeMarkers.length;
  markReadyCount = 0;
  setTimeout(function() {
    if (markReadyCount < markNeed) {
      canvasLoadActive = false;
      applyMarkers();
    }
  }, 2500);
  activeMarkers.forEach(function(m) {
    try { ensureMarkerIcon(m, markOneDone); } catch(e) { markOneDone(); }
  });
}

function clearDomMarkers() {
  dragMarkers.forEach(function(mk) { try { mk.remove(); } catch(e) {} });
  dragMarkers = [];
}

function doAddMarkers(list) {
  clearDomMarkers();
  activeMarkers = (list || []).filter(function(m) { return !m.draggable; });
  (list || []).filter(function(m) { return !!m.draggable; }).forEach(function(m) {
    var el = markerElement(m);
    var mk = new mapboxgl.Marker({ element: el, anchor: markerAnchor(m), draggable: true })
      .setLngLat([m.longitude, m.latitude])
      .addTo(map);
    if (m.title) mk.setPopup(new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: '240px' }).setHTML('<b>' + esc(m.title) + '</b>'));
    el.addEventListener('click', function(ev) { ev.stopPropagation(); postMsg('markerPress', { latitude: m.latitude, longitude: m.longitude }); });
    mk.on('dragend', function() {
      var ll = mk.getLngLat();
      postMsg('markerDragEnd', { latitude: ll.lat, longitude: ll.lng });
      m.latitude = ll.lat; m.longitude = ll.lng;
    });
    dragMarkers.push(mk);
  });
  loadCanvasMarkers();
}

function addMarkers(list) {
  doAddMarkers(list);
}

var userMk = null;
function setUserLocation(lat, lng) {
  if (lat == null || lng == null) {
    if (userMk) { try { userMk.remove(); } catch(e) {} userMk = null; }
    return;
  }
  if (!userMk) {
    var el = document.createElement('div');
    el.style.width = '24px';
    el.style.height = '24px';
    el.innerHTML = '<div class="user-location-wrap"><span class="location-ring"></span><span class="user-dot"></span></div>';
    userMk = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);
  } else {
    userMk.setLngLat([lng, lat]);
  }
}

var currentPolylines = [];
function setPolylines(list) {
  currentPolylines = list || [];
  try { if (map.getLayer('route-layer')) map.removeLayer('route-layer'); } catch(e) {}
  try { if (map.getSource('route')) map.removeSource('route'); } catch(e) {}
  if (!currentPolylines.length) return;
  var feats = currentPolylines.map(function(p) {
    return {
      type: 'Feature',
      properties: { color: p.color || '#3B82F6', width: p.width || 4 },
      geometry: { type: 'LineString', coordinates: (p.coordinates || []) }
    };
  });
  try {
    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });
    map.addLayer({
      id: 'route-layer',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.85 }
    });
  } catch(e) {}
}

function applyInteractive(it) {
  if (!it) return;
  try {
    if (it.scroll === false) { map.dragPan.disable(); map.scrollZoom.disable(); }
    else { map.dragPan.enable(); map.scrollZoom.enable(); }
  } catch(e) {}
  try {
    if (it.zoom === false) {
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollZoom.disable();
      map.keyboard.disable();
    } else {
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollZoom.enable();
      map.keyboard.enable();
    }
  } catch(e) {}
  try {
    if (it.rotate === false) { map.dragRotate.disable(); } else { map.dragRotate.enable(); }
  } catch(e) {}
}

function applyMsg(msg) {
  try {
    if (msg.type === 'init' && msg.region) {
      map.setCenter([msg.region.longitude, msg.region.latitude]);
      if (msg.region.zoom != null) map.setZoom(msg.region.zoom);
      if (msg.interactive) applyInteractive(msg.interactive);
    }
    if (msg.type === 'tiles') {
      setBaseTiles(msg.url);
    }
    if (msg.type === 'setStyle') {
      applyStyle(msg.style);
    }
    if (msg.type === 'markers') {
      doAddMarkers(msg.data || []);
    }
    if (msg.type === 'polylines') {
      setPolylines(msg.data || []);
    }
    if (msg.type === 'userLocation') {
      setUserLocation(msg.latitude, msg.longitude);
    }
    if (msg.type === 'regionChange') {
      map.setCenter([msg.longitude, msg.latitude]);
      if (msg.zoom != null) map.setZoom(msg.zoom);
    }
  } catch(err) {}
}

function markReady() {
  if (mapReady) return;
  mapReady = true;
  while (pendingMsgs.length) applyMsg(pendingMsgs.shift());
  postMsg('ready', {});
}
map.on('load', markReady);
setTimeout(markReady, 600);

function onRCMessage(e) {
  try {
    var msg = JSON.parse(e.data);
    if (!mapReady) {
      pendingMsgs.push(msg);
      return;
    }
    applyMsg(msg);
  } catch(err) {}
}
window.addEventListener('message', onRCMessage);
document.addEventListener('message', onRCMessage);
}
startMap();
});
})();
