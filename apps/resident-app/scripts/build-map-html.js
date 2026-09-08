const fs = require("fs");
const path = require("path");

const root = "C:/Users/lenovo/Desktop/capstone1/ligtas-calbayog";
const srcPath = path.join(root, "apps/resident-app/components/MapView.native.tsx");
const dataPath = path.join(root, "apps/resident-app/components/mapboxData.ts");

const src = fs.readFileSync(srcPath, "utf8");
const open = src.indexOf("const HTML = `") + "const HTML = `".length;
const close = src.indexOf("`;", open);
let html = src.slice(open, close);

const token = fs.readFileSync(dataPath, "utf8").match(/MAPBOX_ACCESS_TOKEN = "([^"]+)"/)[1];
html = html.split("${MAPBOX_ACCESS_TOKEN}").join(token);
if (html.indexOf("${MAPBOX_") > -1) throw new Error("unsubstituted placeholder remains");
html = html.split("\\/").join("/");

const scriptOpen = html.indexOf("<script>");
const scriptClose = html.lastIndexOf("</script>");
const shell = (
  html.slice(0, scriptOpen)
  + '<script src="map-engine.js"></script>'
  + html.slice(scriptClose + "</script>".length)
);
const engine = html.slice(scriptOpen + "<script>".length, scriptClose);

const outDir = path.join(root, "apps/resident-app/public");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "map.html"), shell);
fs.writeFileSync(path.join(outDir, "map-engine.js"), engine);
fs.rmSync(path.join(outDir, "maptest.html"), { force: true });
console.log("wrote map.html", shell.length, "bytes | map-engine.js", engine.length, "bytes");