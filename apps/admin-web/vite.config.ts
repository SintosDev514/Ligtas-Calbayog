import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const apkDir = path.resolve(__dirname, "apk");

function copyApkPlugin() {
  let outDir = "dist";
  return {
    name: "copy-apk",
    configResolved(config: any) {
      outDir = config.build.outDir;
    },
    configureServer(server: any) {
      server.middlewares.use("/apk", (req: any, res: any, next: any) => {
        const fileName = req.url?.split("?")[0]?.replace(/^\/+/, "") || "";
        const filePath = path.join(apkDir, fileName);
        if (!fileName || !filePath.startsWith(apkDir) || !fs.existsSync(filePath)) {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Length", fs.statSync(filePath).size);
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const destDir = path.join(outDir, "apk");
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of fs.readdirSync(apkDir)) {
        const src = path.join(apkDir, file);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(destDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyApkPlugin()],
  resolve: {
    alias: {
      "@shared": "../../shared",
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
