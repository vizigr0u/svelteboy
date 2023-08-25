import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), nodePolyfills({
    exclude: [
      'fs', // Excludes the polyfill for `fs` and `node:fs`.
    ],
    globals: {
      Buffer: true
    }
  }),
  topLevelAwait({
    // The export name of top-level await promise for each chunk module
    promiseExportName: "__tla",
    // The function to generate import names of top-level await promise in each chunk module
    promiseImportName: i => `__tla_${i}`
  }),
  ],
})
