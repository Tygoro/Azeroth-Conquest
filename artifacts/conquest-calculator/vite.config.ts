import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Support both Replit deployment and local development
const rawPort = process.env.PORT || process.env.VITE_PORT || "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Use BASE_PATH from env or default to "/" for local development
const basePath = process.env.BASE_PATH || "/";

// Import Replit plugins only in Replit environment
let runtimeErrorOverlay: any;
try {
  if (process.env.REPL_ID) {
    runtimeErrorOverlay = require("@replit/vite-plugin-runtime-error-modal");
  }
} catch {
  // Plugin not available outside Replit
}

// Build plugins array dynamically
const plugins = [
  react(),
  tailwindcss(),
];

// Add Replit plugins only when in Replit environment
if (runtimeErrorOverlay) {
  plugins.push(runtimeErrorOverlay());
}

// Add Replit dev plugins only in development mode within Replit
if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
  try {
    const cartographer = await import("@replit/vite-plugin-cartographer");
    plugins.push(
      cartographer.cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      })
    );
  } catch {
    // Plugin not available, skip
  }
  
  try {
    const devBanner = await import("@replit/vite-plugin-dev-banner");
    plugins.push(devBanner.devBanner());
  } catch {
    // Plugin not available, skip
  }
}

export default defineConfig({
  base: basePath,
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false, // Allow port to change if occupied
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
