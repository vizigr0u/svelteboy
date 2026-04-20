---
name: optimize-perf
description: >
  Profile-driven performance optimization workflow for SvelteBoy's AssemblyScript/WASM backend.
  Use when asked to optimize emulator performance, investigate slowness, profile hotspots,
  or reduce CPU usage. Covers baseline capture, trace analysis, emulator-specific optimization
  patterns, and regression validation.
argument-hint: "optional: function name or subsystem to focus on (e.g. ppu, memory, opcodes)"
allowed-tools: Bash Grep Read Edit
---

# SvelteBoy Performance Optimization Workflow

## Toolchain

```
# equivalent to `pnpm run asbuild:profilerelease && pnpm run profile`
pnpm run profile:build        # runs 1500 frames of Pokemon Yellow with Node.js V8 profiler
pnpm run benchmark      # 10×1500 frame timing (avg/low/high FPS)
```

Profile output: `profile.cpuprofile` (V8 format) — drag onto **speedscope.app** for flame graph.
The script auto-prints top-5 hotspots by self-time to stdout.

Profile runs against: boot ROM + `roms/games/Pokemon - Yellow Version (UE) [C][!].gb`

---

## Phase 1: Capture Baseline

```bash
pnpm run asbuild:release   # MUST profile release build — debug is 5-10× slower
pnpm run profile 2>&1 | tee profiling/baseline.txt
```

Record from `baseline.txt`:
- Total time (ms)
- Top-5 functions: name, self%, self-ms, wasm location
- Implied FPS = 1500 frames / (total_ms / 1000)

Baseline is invalid if: debug build used, background CPU load high, machine throttling.

---

## Phase 2: Trace Analysis

### Read the .cpuprofile

The file is JSON with:
- `nodes[]`: call frames `{ id, callFrame: { functionName, url, lineNumber } }`
- `samples[]`: node IDs sampled at intervals
- `timeDeltas[]`: microseconds between samples

**To find callers of a hot function:**
```bash
# Find node IDs for the function
node -e "
const p = JSON.parse(require('fs').readFileSync('profile.cpuprofile'));
const ids = p.nodes.filter(n => n.callFrame.functionName.includes('FUNCNAME')).map(n => n.id);
console.log(ids);
"

# Find which nodes have those IDs as children
node -e "
const p = JSON.parse(require('fs').readFileSync('profile.cpuprofile'));
const target = new Set([ID1, ID2]);  // replace with actual IDs
p.nodes.filter(n => n.children?.some(c => target.has(c)))
  .forEach(n => console.log(n.id, n.callFrame.functionName));
"
```

### Patterns to look for

| Pattern | Symptom | Likely cause |
|---------|---------|--------------|
| Memory read/write hot | `readByte`/`writeByte` top of list | Dispatch overhead in `memoryMap.ts` |
| Opcode dispatch hot | `executeOpcode`/`tick` self-time high | Switch-case dispatch, missing inlining |
| PPU dominates | `scanlineRenderer`/`pixelFifo` | Pixel pipeline redundancy per-dot |
| Audio render hot | `render.ts` functions | Sample generation every frame tick |
| Interrupt check hot | `checkInterrupts` called every cycle | Should be gated on IME + IE flags |

---

## Phase 3: Emulator Optimization Patterns

### Memory Dispatch
`assembly/memory/memoryMap.ts` — `readByte`/`writeByte` called millions of times/frame.

- Replace range-check chains with lookup table for I/O region ($FF00–$FFFF)
- Cache frequently-accessed registers (LY, LCDC, SCX/SCY) as module-level vars, write-through on store
- MBC bank switching: guard with dirty flag, skip re-mapping if bank unchanged

### CPU Opcode Dispatch
`assembly/cpu/cpuOps.ts` + `assembly/cpu/opcodes.ts`

- AssemblyScript compiles switch→ dispatch table only if cases are dense — verify with `asc --optimize --debug`
- Inline short opcodes (NOP, INC r, DEC r, LD r,r) via `@inline` decorator
- Eliminate redundant flag recomputation: compute flags once, store in `cpu.f` directly rather than calling flag-setting helpers per ALU op

### PPU
`assembly/io/video/ppu.ts` + `scanlineRenderer.ts`

- Mode 3 (Transfer) runs 172–289 dots/line — avoid allocating per-scanline
- Background tile lookup: cache tile row data for current scanline, not per-pixel
- OAM scan result (10 sprites/line) computed in Mode 2 — don't redo in Mode 3
- `pixelFifo.ts`: if FIFO push/pop is hot, consider replacing circular buffer with index arithmetic on fixed array

### APU / Audio
`assembly/audio/render.ts`

- Audio runs at 44100 Hz but GameBoy ticks at 4.19 MHz — render 1 sample every ~95 CPU cycles
- If sample counter is checked every CPU tick, replace with countdown: decrement counter, render only on zero
- Envelope/sweep updates happen at 64/128 Hz — gate behind frame-sequencer counter, skip 99% of ticks

### Interrupt Check
`assembly/cpu/interrupts.ts`

- IME=0: no interrupts can fire — skip all interrupt logic entirely
- `IF & IE == 0`: no pending — skip
- Check should be a single `if (interruptsMaster && (interruptFlags & interruptEnabled))` gate

### General AssemblyScript / WASM

- `@inline` on hot helpers (flag accessors, register getters)
- Prefer `i32` over `bool` for hot paths (WASM bool = i32 anyway, avoids coercion)
- Avoid closures/function references in hot loops — WASM indirect calls are ~3× slower than direct
- `unchecked()` for array accesses in tight loops where bounds are proven safe
- `load<u8>(ptr)` / `store<u8>(ptr, val)` directly on WASM linear memory for zero-overhead byte access

---

## Phase 4: Implement and Validate

1. Make one targeted change at a time
2. Rebuild: `pnpm run asbuild:release`
3. Run regression tests: `pnpm test`
4. Re-profile: `pnpm run profile 2>&1 | tee after_CHANGENAME.txt`
5. Compare:

```bash
# Quick diff of top-5 output
diff <(grep -A6 "Top 5" baseline.txt) <(grep -A6 "Top 5" after_CHANGENAME.txt)

# FPS delta
grep "total" baseline.txt after_CHANGENAME.txt
```

Benchmark for wall-clock regression: `pnpm run benchmark`

A change is worth keeping if:
- Target function self-% drops meaningfully (>1%), OR
- Benchmark FPS improves ≥2%, AND
- All tests pass

Revert if tests fail — correctness > speed.

---

## Quick-Reference: Key Files

| File | What's there |
|------|-------------|
| `assembly/memory/memoryMap.ts` | All read/writeByte dispatch |
| `assembly/cpu/cpuOps.ts` | Opcode implementations |
| `assembly/cpu/opcodes.ts` | Decode tables (256 + 256 CB) |
| `assembly/cpu/alu.ts` | ALU ops + flag logic |
| `assembly/cpu/interrupts.ts` | IME + IF/IE check |
| `assembly/io/video/ppu.ts` | Main PPU tick |
| `assembly/io/video/scanlineRenderer.ts` | Per-scanline pixel render |
| `assembly/io/video/pixelFifo.ts` | FIFO pipeline |
| `assembly/audio/render.ts` | Sample generation |
| `assembly/audio/apu.ts` | APU tick, frame sequencer |
| `assembly/emulator.ts` | Main loop: CPU+Timer+PPU+DMA tick order |
| `tools/runrom/index.js` | Profile/benchmark runner |

$ARGUMENTS
