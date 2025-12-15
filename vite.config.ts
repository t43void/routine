import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isTauri = process.env.TAURI_PLATFORM !== undefined;
  
  return {
    server: {
      host: "::",
      port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 8080,
      strictPort: !isTauri, // Allow port change in Tauri mode if port is busy
      watch: {
        // Tauri uses a fixed port, so we need to disable HMR in Tauri mode
        ignored: isTauri ? ["**/src-tauri/**"] : [],
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: isTauri ? "dist-tauri" : "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    // Tauri expects a fixed port, fail if that port is not available
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
  };
});
