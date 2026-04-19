import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
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
  plugins: [svelte(),
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
