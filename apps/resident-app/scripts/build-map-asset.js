const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public/map.html");
const enginePath = path.join(root, "public/map-engine.js");
const outPath = path.join(root, "assets/map-page.html");
const outJsPath = path.join(root, "assets/map-page-html.js");

let html = fs.readFileSync(htmlPath, "utf8");
const engine = fs.readFileSync(enginePath, "utf8");

const scriptRe = /<script src="map-engine\.js\?v=\d+"><\/script>/;
if (!scriptRe.test(html)) throw new Error("map-engine.js script tag not found in map.html");
html = html.replace(scriptRe, "<script>" + engine + "</script>");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);

// Emit a plain JS module that exports the same self-contained HTML page as a string.
// The WebView loads this string via source={{ html }} so the map never depends on
// file:// asset extraction, the dev server, or expo-asset resolution (which does not
// work in standalone/release APKs without expo-updates).
fs.writeFileSync(outJsPath, "module.exports = " + JSON.stringify(html) + ";\n");

console.log("wrote", outPath, html.length, "bytes");
console.log("wrote", outJsPath);