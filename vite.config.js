import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  esbuild: {
    loader: "jsx",
  },
  server: {
    // Only proxy if Firebase emulator is explicitly enabled
    proxy: process.env.USE_FIREBASE_EMULATOR === 'true' ? {
      '/lists': {
        target: 'http://127.0.0.1:5001/strive-11ef5/us-central1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    } : undefined,
  },
});
