import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom"], echarts: ["echarts"], charts: ["recharts"], supabase: ["@supabase/supabase-js"] } } },
  },
  test: { environment: "node" },
});
