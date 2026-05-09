import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function git(cmd: string, fallback = ''): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

function detectBranch(): string {
  const envBranch =
    process.env.GITHUB_REF_NAME ||
    process.env.CF_PAGES_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.BRANCH ||
    '';
  if (envBranch) return envBranch;
  // Detached HEAD (common on CI shallow checkouts) returns the literal "HEAD" — drop it.
  const b = git('rev-parse --abbrev-ref HEAD');
  return b === 'HEAD' ? '' : b;
}

const sha =
  process.env.GITHUB_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  git('rev-parse HEAD');
const inCI = !!(
  process.env.GITHUB_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CI
);
const buildInfo = {
  version: pkg.version,
  sha,
  shortSha: sha.slice(0, 7),
  branch: detectBranch(),
  dirty: !inCI && git('status --porcelain') !== '',
  commitDate: git('log -1 --format=%cI'),
  buildDate: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID || '',
};

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  build: {
    target: 'esnext',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
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
