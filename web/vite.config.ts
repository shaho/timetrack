import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev server proxies API calls to the Bun server (bun run serve).
      "/api": "http://localhost:4242",
    },
  },
});
