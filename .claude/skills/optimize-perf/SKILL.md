---
name: optimize-perf
description: "Profile-driven performance optimization for SvelteBoy AssemblyScript/WASM backend. Use when asked to optimize emulator performance, profile hotspots, or reduce CPU usage."
argument-hint: "optional: subsystem to focus on (e.g. ppu, cpu, memory)"
allowed-tools: Bash Grep Read Edit
---

## Commands

```bash
pnpm run profile:build   # build profilerelease + run 1500 frames with V8 profiler → profile.cpuprofile
pnpm run bench           # 10×1500 frames, prints avg/low/high FPS  (NOT "benchmark" — that script doesn't exist)
./node_modules/.bin/asc assembly/index.ts --target release --textFile build/backend.wat  # WAT for analysis
pnpm run asbuild:release # standard release build
```

Always profile release build. Debug is 5–10× slower.

## Wasm Index → Function Name

Profile reports `wasm-function[N]`. Imports get indices before defined functions — naive WAT counting is wrong. Use:

```bash
node -e "
const wat = require('fs').readFileSync('build/backend.wat', 'utf8');
const m = {}, l = wat.split('\n'); let i = 0;
for (const ln of l) { const r = ln.match(/\(import .* \(func \\\$([^\s)]+)/); if (r) m[i++] = '(imp)'+r[1]; }
for (const ln of l) { const r = ln.match(/^ \(func \\\$([^\s)]+)/); if (r) m[i++] = r[1]; }
[/* indices */].forEach(n => console.log(n, m[n]));
"
```

## Empirical Hotspots (Pokemon Yellow, 1500 frames, release, ~1315 FPS baseline)

| wasm idx | Function | Self% |
|----------|----------|-------|
| 567 | `Emulator.Tick` | 13.1% |
| 558 | `Cpu.executeNextInstruction` | 11.4% |
| 564 | `ScanlineRenderer.Render` | 10.5% |
| 560 | `Timer.Tick` | 9.8% |
| 603 | `Emulator.GetStopReason` | 7.6% |

Note: indices shift with each build. Re-map after every change.

## Validation Threshold

Keep a change if FPS improves ≥2% AND `pnpm test` passes. Revert otherwise.

## Dead Ends

### `store<u8>` + `changetype<usize>` in scanlineRenderer inner loop — zero effect

`unchecked(StaticArray[i] = v)` already compiles to `i32.store8` with no per-iteration shadow stack update. The managed ref hits the shadow stack once at function entry only. `changetype<usize>` generates identical WAT. Do not retry.

$ARGUMENTS
