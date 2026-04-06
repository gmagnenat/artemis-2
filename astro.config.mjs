import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api/horizons": {
          target: "https://ssd.jpl.nasa.gov",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/horizons/, "/api/horizons.api"),
        },
      },
    },
  },
});
