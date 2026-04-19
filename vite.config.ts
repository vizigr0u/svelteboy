import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'components': path.resolve(__dirname, './src/lib'),
      'stores': path.resolve(__dirname, './src/stores'),
    },
  },
  plugins: [svelte(), nodePolyfills({
    exclude: [
      'fs', 'process'
    ],
    globals: {
      Buffer: true
    }
  }),
  {
    name: 'wasm-full-reload',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.wasm')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    }
  }
  ],
})
