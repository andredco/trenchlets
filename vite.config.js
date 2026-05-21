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
        play: resolve(__dirname, "play.html"),
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
});
