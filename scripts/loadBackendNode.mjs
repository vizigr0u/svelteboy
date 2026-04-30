// Node-side backend loader for tests / runrom / bench tools.
// Mirrors src/emulator/backendLoader.ts but instantiates eagerly at module load
// so consumers can use named-style destructuring.

import { loadBackendInstance } from '../build/backend.js';

const INITIAL_PAGES = 256;
const MAXIMUM_PAGES = 1024;

export const memory = new WebAssembly.Memory({
    initial: INITIAL_PAGES,
    maximum: MAXIMUM_PAGES,
    shared: true,
});

const backend = await loadBackendInstance({ env: { memory } });

export default backend;
