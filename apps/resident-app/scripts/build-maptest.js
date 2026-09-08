const fs = require("fs");
const path = require("path");

const root = "C:/Users/lenovo/Desktop/capstone1/ligtas-calbayog";
const srcPath = path.join(root, "apps/resident-app/components/MapView.native.tsx");
const dataPath = path.join(root, "apps/resident-app/components/mapboxData.ts");

const src = fs.readFileSync(srcPath, "utf8");
const open = src.indexOf("const HTML = `") + "const HTML = `".length;
const close = src.indexOf("`;", open);
let html = src.slice(open, close);

const tokenMatch = fs.readFileSync(dataPath, "utf8").match(/MAPBOX_ACCESS_TOKEN = "([^"]+)"/);
html = html.split("${MAPBOX_ACCESS_TOKEN}").join(tokenMatch[1]);

if (html.indexOf("${MAPBOX_") > -1) {
  throw new Error("unsubstituted placeholder remains: " + html.match(/\$\{MAPBOX_[^}]+\}/g).join(", "));
}

html = html.split("\\/").join("/");

const probe = `
<div id="probe" style="position:absolute;left:0;right:0;bottom:0;background:rgba(15,23,42,0.85);color:#E2E8F0;font:11px/1.4 monospace;padding:6px 8px;z-index:20;pointer-events:none;white-space:pre-wrap"></div>
<script>
(function(){
  try {
    setInterval(function(){
      var st = document.getElementById('mb-status');
      var probe = document.getElementById('probe');
      if (!probe) return;
      probe.textContent =
        'mapboxgl=' + (typeof mapboxgl) +
        ' | canvas=' + document.querySelectorAll('canvas.mapboxgl-canvas').length +
        ' | markers=' + document.querySelectorAll('.mapboxgl-marker').length +
        ' | userWrap=' + document.querySelectorAll('.user-location-wrap').length +
        "\\noverlay='" + (st ? st.textContent : 'GONE(hidden)') + "'";
    }, 2000);
  } catch(e) {}
})();
<\/script>`;
html = html.replace("</body>", probe + "</body>");

const outDir = path.join(root, "apps/resident-app/public");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "maptest.html"), html);
console.log("wrote public/maptest.html", html.length, "bytes");