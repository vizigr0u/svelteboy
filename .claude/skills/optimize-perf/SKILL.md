---
name: optimize-perf
description: "Profile-driven performance optimization for SvelteBoy AssemblyScript/WASM backend. Use when asked to optimize emulator performance, profile hotspots, or reduce CPU usage."
argument-hint: "optional: subsystem to focus on (e.g. ppu, cpu, memory)"
allowed-tools: Bash Grep Read Edit
---

## Commands

```bash
pnpm profile:build   # build profilerelease + run frames → profile.cpuprofile
pnpm bench:build     # build release + run frames, prints avg/low/high FPS
./node_modules/.bin/asc assembly/index.ts --target release --textFile build/backend.wat  # WAT for analysis
pnpm asbuild:release # standard release build
```

Always profile profilerelease build - optimized with debug symbols.

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

## Process

One idea per change. Profile before+after each. No batching. Keep/revert before next idea.
No specific optimization target? Use `pnpm profile:build`
Target function? Use `pnpm profile:fn:build -- <FunctionName>`.

## Validation Threshold

Keep a change if FPS improves ≥2% AND `pnpm test` passes. Revert otherwise.

## Profiling Inlined / Shallow Code

CPU profiler misses heavily-inlined code — never appears in call tree. Use manual `perfNow()` timing instead.

Bracket section with `perfNow()`, accumulate into static fields, report via `instrumentedDiag()`.

`perfNow()` = expensive host call. **Guard every call with `isDefined(INSTRUMENTED)`** — never in release/profilerelease.

```typescript
import { perfNow } from "../../debug/perfMarks";

static myTotalTicks: f64 = 0;

static MyHotFn(): void {
    let t0: f64 = 0;
    // @ts-ignore
    if (isDefined(INSTRUMENTED)) t0 = perfNow();
    // ... hot code ...
    // @ts-ignore
    if (isDefined(INSTRUMENTED)) MyClass.myTotalTicks += perfNow() - t0;
}
```

Reset in `Init()`, log in diag fn. Wire into `instrumentedDiag()` (`assembly/index.ts`):

```typescript
export function instrumentedDiag(): void {
    MyClass.MyDiag(); // logs accumulated ticks
}
```

Build with `instrumented` target (`--use INSTRUMENTED=1`). Call `instrumentedDiag()` from JS after benchmark to read results.

## Dead Ends

### `store<u8>` + `changetype<usize>` in scanlineRenderer inner loop — zero effect

`unchecked(StaticArray[i] = v)` already compiles to `i32.store8` with no per-iteration shadow stack update. The managed ref hits the shadow stack once at function entry only. `changetype<usize>` generates identical WAT. Do not retry.

$ARGUMENTS
