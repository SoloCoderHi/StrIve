import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  esbuild: {
    loader: "jsx",
  },
  server: {
    proxy: process.env.USE_FIREBASE_EMULATOR === 'true' ? {
      // Use Firebase emulator
      '/lists': {
        target: 'http://127.0.0.1:5001/strive-11ef5/us-central1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    } : {
      // Use deployed Firebase functions - proxy to cloud functions
      '/lists': {
        target: 'https://us-central1-strive-11ef5.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // Route to appropriate function based on path
          if (path.includes('/import/analyze')) {
            return '/analyzeListImport' + path;
          } else if (path.includes('/import/confirm')) {
            return '/confirmListImport' + path;
          } else {
            return '/listsExport' + path;
          }
        },
      },
    },
  },
});
