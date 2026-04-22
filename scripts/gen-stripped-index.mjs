#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('assembly/index.ts', 'utf8');

const lines = src.split('\n');
const out = [];
let stripping = false;

for (const line of lines) {
  if (line.trim() === '// #strip-start') { stripping = true; continue; }
  if (line.trim() === '// #strip-end')   { stripping = false; continue; }
  if (!stripping) out.push(line);
}

// Collapse consecutive blank lines, trim trailing
const result = out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
writeFileSync('assembly/index.stripped.ts', result);
console.log('Generated assembly/index.stripped.ts');
