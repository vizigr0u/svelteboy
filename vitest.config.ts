import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            stores: fileURLToPath(new URL('./src/stores', import.meta.url)),
            components: fileURLToPath(new URL('./src/lib', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        setupFiles: ['./src/test-setup.ts'],
    },
});
