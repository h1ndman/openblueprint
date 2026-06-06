import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the whole app into ONE self-contained index.html (JS + CSS inlined)
// that runs fully offline by double-clicking it — no server, no network.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-offline",
    emptyOutDir: true,
  },
});
