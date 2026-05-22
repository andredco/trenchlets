import { defineConfig } from "vite";
import { resolve } from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      // Enable Buffer + global polyfills that @solana/wallet-adapter-* expects.
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        world: resolve(__dirname, "world.html"),
        docs: resolve(__dirname, "docs.html"),
      },
    },
  },
  optimizeDeps: {
    include: [
      "@solana/wallet-adapter-base",
      "@solana/wallet-adapter-phantom",
      "@solana/wallet-adapter-solflare",
      "@solana/wallet-adapter-backpack",
      "bs58",
    ],
  },
  // Local dev: forward /api and /ws to the Node server on :3000 so the
  // frontend at :5173 can talk to a real backend without CORS dance.
  // Run the backend in another terminal: `cd server && npm run dev`.
  // Or just run `npm run dev:full` from the repo root to start both.
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws":  { target: "ws://localhost:3000", ws: true },
      "/admin": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
