---
name: gameboy-docs
description: Complete Game Boy DMG hardware reference — all registers, timing, opcodes, PPU modes, APU circuits, MBC banking. Authoritative inline spec for emulator implementation.
argument-hint: "optional topic: cpu|ppu|apu|mbc|timer|interrupts|memory|joypad|serial|boot"
---

You are implementing SvelteBoy, a Game Boy DMG emulator. This file contains authoritative hardware spec.
if anything is missing or unclear, first check the pandoc .md files in pandocs/ directory, then prompt to see if you should search online.

---

## SPECS (DMG)

- CPU: SM83 (8080-like), 4.194304 MHz master clock, system clock = master/4
- WRAM: 8 KiB; VRAM: 8 KiB; LCD: 160×144; OBJ: 8×8 or 8×16, max 40/screen 10/line
- Palettes (DMG): BG 1×4, OBJ 2×3; Colors: 4 shades of green; Vsync: 59.73 Hz
- APU: 4 channels, stereo output; Sound: DMG 4 channels
- Frame: ~16.74 ms (NOT exactly 60 Hz — 0.45% slow); 1 dot = 1 T-cycle = 2^22 Hz ≈ 4.194 MHz

---

## MEMORY MAP

| Range | Description |
|-------|-------------|
| $0000–$3FFF | ROM bank 00 (fixed) |
| $4000–$7FFF | ROM bank 01–NN (switchable via MBC) |
| $8000–$9FFF | VRAM (8 KiB) |
| $A000–$BFFF | External RAM (cartridge) |
| $C000–$CFFF | WRAM bank 0 (4 KiB) |
| $D000–$DFFF | WRAM bank 1 (4 KiB) |
| $E000–$FDFF | Echo RAM (mirror of C000–DDFF, prohibited) |
| $FE00–$FE9F | OAM (40 entries × 4 bytes) |
| $FEA0–$FEFF | Prohibited (DMG: reads trigger OAM corruption during mode 2, else $00) |
| $FF00–$FF7F | I/O Registers |
| $FF80–$FFFE | HRAM |
| $FFFF | IE (Interrupt Enable) |

**Echo RAM**: E000–FDFF mirrors C000–DDFF (only lower 13 address bits connected). Same effect as C000–DDFF reads/writes. Prohibited by Nintendo.

**Jump vectors**: RST = $0000,$0008,$0010,$0018,$0020,$0028,$0030,$0038; Interrupts = $0040,$0048,$0050,$0058,$0060

**VRAM layout**: 384 tiles × 16 bytes = $8000–$97FF (tile data); two 32×32 tile maps at $9800–$9BFF and $9C00–$9FFF

---

## HARDWARE REGISTERS

| Addr | Name | R/W | Description |
|------|------|-----|-------------|
| $FF00 | P1/JOYP | Mixed | Joypad |
| $FF01 | SB | R/W | Serial transfer data |
| $FF02 | SC | Mixed | Serial transfer control |
| $FF04 | DIV | R/W | Divider (write resets to $00) |
| $FF05 | TIMA | R/W | Timer counter |
| $FF06 | TMA | R/W | Timer modulo |
| $FF07 | TAC | R/W | Timer control |
| $FF0F | IF | R/W | Interrupt flag |
| $FF10–$FF26 | NR10–NR52 | Mixed | Audio |
| $FF30–$FF3F | Wave RAM | R/W | CH3 waveform |
| $FF40 | LCDC | R/W | LCD control |
| $FF41 | STAT | Mixed | LCD status |
| $FF42 | SCY | R/W | BG viewport Y |
| $FF43 | SCX | R/W | BG viewport X |
| $FF44 | LY | R | LCD Y coordinate |
| $FF45 | LYC | R/W | LY compare |
| $FF46 | DMA | R/W | OAM DMA source/start |
| $FF47 | BGP | R/W | BG palette (DMG only) |
| $FF48 | OBP0 | R/W | OBJ palette 0 (DMG only) |
| $FF49 | OBP1 | R/W | OBJ palette 1 (DMG only) |
| $FF4A | WY | R/W | Window Y position |
| $FF4B | WX | R/W | Window X position +7 |
| $FF50 | BANK | W | Boot ROM disable |
| $FFFF | IE | R/W | Interrupt enable |

---

## CPU

### Registers

| 16-bit | Hi | Lo | Purpose |
|--------|----|----|---------|
| AF | A | — | Accumulator & Flags |
| BC | B | C | General purpose |
| DE | D | E | General purpose |
| HL | H | L | General purpose / indirect |
| SP | — | — | Stack Pointer |
| PC | — | — | Program Counter |

### Flags (lower byte of AF)

| Bit | Flag | Set when |
|-----|------|----------|
| 7 | Z | Result = 0 |
| 6 | N | Subtraction (BCD) |
| 5 | H | Half-carry (BCD) |
| 4 | C | Carry / borrow / shift-out 1 |

Carry set: 8-bit add > $FF, 16-bit add > $FFFF, sub/cmp < 0, rotate/shift outputs 1. BCD flags (N,H) used only by DAA.

### Instruction Encoding

**Placeholders**: `r8` = B/C/D/E/H/L/[HL]/A (0–7); `r16` = BC/DE/HL/SP; `r16stk` = BC/DE/HL/AF; `r16mem` = BC/DE/HL+/HL-; `cond` = nz/z/nc/c; `b3` = bit index 0–7; `tgt3` = RST target/8; `imm8`/`imm16` = following bytes (little-endian)

**Block 0**: nop; `ld r16,imm16`; `ld [r16mem],a`; `ld a,[r16mem]`; `ld [imm16],sp`; `inc/dec r16`; `add hl,r16`; `inc/dec r8`; `ld r8,imm8`; rlca/rrca/rla/rra/daa/cpl/scf/ccf; `jr imm8`; `jr cond,imm8`; stop

**Block 1**: `ld r8,r8` — except `ld [hl],[hl]` = **halt** ($76)

**Block 2**: add/adc/sub/sbc/and/xor/or/cp a,r8

**Block 3**: add/adc/sub/sbc/and/xor/or/cp a,imm8; ret cond; ret; reti; jp cond,imm16; jp imm16; jp hl; call cond,imm16; call imm16; rst tgt3; pop/push r16stk; $CB prefix; ldh [c],a; ldh [imm8],a; ld [imm16],a; ldh a,[c]; ldh a,[imm8]; ld a,[imm16]; add sp,imm8; ld hl,sp+imm8; ld sp,hl; di; ei

**Invalid opcodes (hard-lock CPU)**: $D3,$DB,$DD,$E3,$E4,$EB,$EC,$ED,$F4,$FC,$FD

**$CB prefix**: rlc/rrc/rl/rr/sla/sra/swap/srl r8; bit/res/set b3,r8

**STOP**: 2-byte instruction; second byte not always ignored. On DMG, must disable LCD before entering STOP or risk hardware damage (black line burned in). Terminated by P10–P13 low (button press).

### SM83 vs Z80 differences

No IX/IY registers; no DD/FD/ED prefixes; no second register set; no dedicated I/O bus (use LDH instead); parity/sign/overflow flags removed; `RETI` replaces `EXX` ($D9); `SWAP` replaces `SLL` ($CB3x); `ADD SP,dd` replaces `RET M`; autoincrement HL access added; all timings multiple of 4 T-cycles. Approx speed of 4 MHz Z80.

| Opcode | Z80 | SM83 |
|--------|-----|------|
| $08 | EX AF,AF | LD (nn),SP |
| $10 | DJNZ | STOP |
| $22 | LD (nn),HL | LDI (HL),A |
| $2A | LD HL,(nn) | LDI A,(HL) |
| $32 | LD (nn),A | LDD (HL),A |
| $3A | LD A,(nn) | LDD A,(HL) |
| $D9 | EXX | RETI |
| $E0 | RET PO | LD (FF00+n),A |
| $E2 | JP PO,nn | LD (FF00+C),A |
| $E8 | RET PE | ADD SP,dd |
| $EA | JP PE,nn | LD (nn),A |
| $F0 | RET P | LD A,(FF00+n) |
| $F2 | JP P,nn | LD A,(FF00+C) |
| $F8 | RET M | LD HL,SP+dd |
| $FA | JP M,nn | LD A,(nn) |
| $CB3x | SLL | SWAP |

---

## HALT

`halt` pauses CPU until `IE & IF != 0`. IME must be set for interrupt to be serviced after wake.

**halt bug**: When `IME=0` and `IE & IF != 0` at time of `halt`: halt exits immediately, but **PC is not incremented** — the byte after halt is read twice.

- If `halt` immediately after `ei` (IME still 0): interrupt serviced, handler returns to halt, waits again.
- If `halt` immediately before `rst`: RST return address points to RST itself (not byte after it).
- If `ei` before halt AND `rst` after halt: `ei` case wins.

---

## INTERRUPTS

### IME (Interrupt Master Enable) — write-only, internal flag

- `ei`: IME=1 (effect delayed one instruction)
- `di`: IME=0
- `reti`: IME=1 + return
- Entering handler: IME=0

`ei` effect delayed by one instruction: `ei` followed immediately by `di` allows no interrupt.

### FF0F — IF: Interrupt Flag | $FFFF — IE: Interrupt Enable

Both same bit layout:

| Bit | Source | Vector |
|-----|--------|--------|
| 0 | VBlank | $0040 |
| 1 | STAT/LCD | $0048 |
| 2 | Timer | $0050 |
| 3 | Serial | $0058 |
| 4 | Joypad | $0060 |

Bit 0 = highest priority. IF bit set = interrupt requested. Serviced only when `IME=1` AND matching IE bit set.

### Interrupt Dispatch (5 M-cycles total)

1. Reset IF bit and IME
2. 2 wait states (2 M-cycles)
3. Push current PC to stack (2 M-cycles)
4. Set PC to handler address (1 M-cycle)

### Interrupt Sources

- **VBlank** ($0040): Fires when PPU enters VBlank (LY=144), ~59.7 Hz. VRAM freely accessible during VBlank (~1.1 ms).
- **STAT** ($0048): Rising edge on shared STAT interrupt line (OR of enabled sources: mode 0/1/2, LYC=LY). **STAT blocking**: if line already high, no interrupt fires for subsequent sources.
- **Timer** ($0050): Fires when TIMA overflows ($FF→$00+interrupt).
- **Serial** ($0058): Fires on completion of 8-bit serial transfer.
- **Joypad** ($0060): Fires when P10–P13 go high→low (button pressed). Switch bounce common. Useful mainly to exit STOP mode.

---

## TIMER

### Registers

- **$FF04 DIV**: Increments at 16384 Hz. Write any value → reset to $00. Also reset by `stop`. DIV is the visible upper 8 bits of the 16-bit system counter.
- **$FF05 TIMA**: Incremented at rate set by TAC. On overflow: reset to TMA, request timer interrupt.
- **$FF06 TMA**: Reload value for TIMA on overflow.
- **$FF07 TAC**:
  - Bit 2: Timer enable (TIMA; DIV always counts)
  - Bits 1–0 clock select:
    - 00: every 256 M-cycles → 4096 Hz
    - 01: every 4 M-cycles → 262144 Hz
    - 10: every 16 M-cycles → 65536 Hz
    - 11: every 64 M-cycles → 16384 Hz

### Obscure Behavior (DMG)

System counter (full 16-bit) drives timer via falling-edge detector on selected bit:

- Writing DIV (resets counter to 0) can instantly trigger a timer tick if selected bit was 1.
- Changing TAC clock select from a set bit to a clear bit sends a timer tick.
- On DMG: disabling timer while selected bit is set sends one tick.
- TIMA overflow behavior: TIMA=0 for **one M-cycle** (cycle A), then TMA copied and IF set (cycle B).
  - Writing TIMA during cycle A cancels the overflow (no TMA copy, no IF set).
  - Writing TIMA during cycle B is ignored (TMA wins).
  - Writing TMA during cycle B: same value copies to TIMA on same cycle.
- DIV-APU: APU events triggered by falling edge on bit 4 of system counter (512 Hz).

---

## PPU / GRAPHICS

### PPU Modes (per scanline, 456 dots total)

| Mode | Action | Duration | CPU VRAM access | CPU OAM access |
|------|--------|----------|-----------------|----------------|
| 2 | OAM scan | 80 dots | Yes | No |
| 3 | Pixel transfer | 172–289 dots | No | No |
| 0 | HBlank | 376 - mode3 dots | Yes | Yes |
| 1 | VBlank | 4560 dots (lines 144–153) | Yes | Yes |

Frame: 154 scanlines × 456 dots = 70224 dots total.

### Mode 3 Length Penalties

Default minimum: 172 dots (160px + 12 fixed). Penalties lengthen Mode 3, shorten Mode 0:
- SCX % 8 extra dots at start (pixel discard)
- +6 dots for window activation
- Per-object: 6–11 dots each (see OBJ penalty algorithm)
- OBJ at X=0: always 11 dots regardless of SCX

**OBJ penalty algorithm**: For each OBJ's leftmost pixel ("The Pixel"):
1. Find which BG/window tile contains The Pixel.
2. If tile not yet seen by prior OBJ: penalty = max(0, pixels_right_of_Pixel_in_tile - 2) dots.
3. +6 flat dots (OBJ tile fetch).

### FF40 — LCDC

| Bit | Function | 0 | 1 |
|-----|----------|---|---|
| 7 | LCD+PPU enable | Off | On |
| 6 | Window tile map | $9800 | $9C00 |
| 5 | Window enable | Off | On |
| 4 | BG+Window tile data | $8800 ($9000 base, signed) | $8000 (unsigned) |
| 3 | BG tile map | $9800 | $9C00 |
| 2 | OBJ size | 8×8 | 8×16 |
| 1 | OBJ enable | Off | On |
| 0 | BG+Window enable (DMG) | White (off) | On |

**LCDC.7**: Disable only during VBlank — disabling during active display burns hardware. Screen blank (white) while disabled; first frame after re-enable is blank.

**LCDC.4 (BG/Win tile addressing)**:
- Mode 1 ($8000 method): tiles 0–127 in block 0 ($8000–$87FF), 128–255 in block 1 ($8800–$8FFF). Unsigned.
- Mode 0 ($8800 method): tiles 0–127 in block 2 ($9000–$97FF), 128–255 in block 1. $9000 = signed base.
- OBJ always use $8000 method.

**LCDC.0 (DMG)**: Clears both BG and Window (white); LCDC.5 ignored. Objects can still show.

### FF41 — STAT

| Bit | Field | R/W |
|-----|-------|-----|
| 6 | LYC int select | R/W |
| 5 | Mode 2 int select | R/W |
| 4 | Mode 1 int select | R/W |
| 3 | Mode 0 int select | R/W |
| 2 | LYC == LY | R |
| 1–0 | PPU mode | R |

**Spurious STAT (DMG only)**: Writing to STAT during OAM scan/HBlank/VBlank/LYC=LY triggers LCD interrupt as if $FF written for one M-cycle.

### FF44 — LY (read-only)
Current scanline 0–153. 144–153 = VBlank.

### FF45 — LYC
Compared with LY each dot; match sets STAT bit 2 and (if enabled) fires STAT interrupt.

### VRAM Tile Data ($8000–$97FF)

Three blocks of 128 tiles each:
- Block 0: $8000–$87FF (IDs 0–127 for OBJ/$8000 mode)
- Block 1: $8800–$8FFF (IDs 128–255 for OBJ/$8000 mode; IDs 128–255/-128-(-1) for $8800 mode)
- Block 2: $9000–$97FF (IDs 0–127 for $8800 mode)

**Tile format**: 16 bytes per tile, 2 bytes per row. Byte 1 = LSB of color IDs, byte 2 = MSB. Bit 7 = leftmost pixel. Color = {byte2_bit, byte1_bit} per pixel. Range 0–3. Color 0 in OBJ = transparent.

### VRAM Tile Maps ($9800–$9FFF)

Two 32×32 = 1024 byte maps. Each byte = tile index. Map address = $9800 or $9C00 per LCDC.3/6. Tile address = entry Y * 32 + entry X. BG viewport: 160×144 window into 256×256 map, wraps around.

### OAM ($FE00–$FE9F): 40 entries × 4 bytes

| Byte | Content |
|------|---------|
| 0 | Y position + 16 (Y=16 → top of screen; Y=0 or Y≥160 → hidden) |
| 1 | X position + 8 (X=0 or X≥168 → hidden but still counts toward 10/line limit) |
| 2 | Tile index (8×8: full byte; 8×16: bit 0 ignored, top tile = idx&$FE, bottom = idx\|$01) |
| 3 | Attributes |

**Byte 3 attributes**:
| Bit | Name | 0 | 1 |
|-----|------|---|---|
| 7 | BG priority | OBJ on top | BG color 1–3 over OBJ |
| 6 | Y flip | Normal | Vertical mirror |
| 5 | X flip | Normal | Horizontal mirror |
| 4 | DMG palette | OBP0 | OBP1 |

**OBJ selection priority**: PPU scans OAM $FE00→$FE9F, selects first 10 with Y overlapping LY. Off-screen Y still counts!

**OBJ drawing priority (DMG)**: Lower X wins. Tie: lower OAM index wins.

**DMA recommended approach**: Write to WRAM buffer, then OAM DMA. Direct OAM write only during mode 0–1.

### FF46 — OAM DMA

Write high byte of source address ($00–$DF). Copies $XX00–$XX9F → $FE00–$FE9F. Takes 160 M-cycles. CPU can only access HRAM during DMA (DMG). Run from HRAM, wait loop:

```rgbasm
run_dma:
    ld a, HIGH(src)
    ldh [$FF46], a
    ld a, 40
.wait: dec a / jr nz,.wait / ret
```

DMA during mode 2: OBJ seen as off-screen. DMA during mode 3: PPU reads corrupt word being written.

### VRAM / OAM Access Restrictions

- VRAM accessible: modes 0, 1, 2 (not 3)
- OAM accessible: modes 0, 1 (not 2, 3)
- During LCD off: both accessible
- Reads during inaccessible period return $FF; writes ignored

### Scrolling

**$FF42 SCY, $FF43 SCX**: BG viewport top-left. Values 0–255. Wraps. Bottom = (SCY+143)%256, Right = (SCX+159)%256.

SCX% 8 read only at scanline start; tile X re-read each tile fetch.

**$FF4A WY, $FF4B WX**: Window top-left = (WX-7, WY). Window visible: WX=0..166, WY=0..143. WX=0 and WX=166 have hardware bugs. Window internal Y counter increments only when window renders on scanline; reset to 0 during VBlank.

Window conditions for scanline: WY==LY must have been true this frame (checked at mode 2 start) AND WX condition triggered AND LCDC.5 set.

### Palettes (DMG)

**$FF47 BGP**: Color for IDs 0–3. Bits 7–6 = color for ID3, ..., 1–0 = color for ID0. Values: 0=white, 1=light gray, 2=dark gray, 3=black.

**$FF48 OBP0, $FF49 OBP1**: Same format, but lower 2 bits ignored (ID0 = transparent).

### Pixel FIFO

Two FIFOs (BG and OBJ), each up to 16 pixels. Only active during mode 3. Each pixel has: color (0–3), palette, sprite priority, BG priority.

**Fetcher steps** (BG/Window pixels):
1. **Get Tile** (2 dots): determine tile from tilemap using SCX/SCY or window coords. X = ((SCX/8)+fetcherX)&$1F; Y = (LY+SCY)&$FF. Window overrides when in window region.
2. **Get Tile Data Low** (2 dots): fetch low byte of tile row (checks LCDC.4).
3. **Get Tile Data High** (2 dots): fetch high byte; also attempts push to BG FIFO.
4. **Sleep** (2 dots): nothing.
5. **Push**: push 8 pixels to BG FIFO only if FIFO empty.

VRAM reads blocked → returns $FF. VRAM blocked at: LCD off, mode 3→0 switch. Restored at: mode 2→3 switch.

**OBJ fetching**: When OBJ's X reached during mode 3, fetcher paused until step 5 or FIFO non-empty. OBJ tile fetched; pixels merged into OBJ FIFO (non-transparent from higher-priority OBJ wins).

**Pixel rendering**: Pop one from each FIFO. OBJ pixel wins if non-transparent (color≠0) AND LCDC.1=1. BG priority flag checked. DMG: color from BGP/OBP0/OBP1.

Window start resets BG FIFO and fetcher to step 1.

### OAM Corruption Bug (DMG only, not CGB)

Triggered when: 16-bit register $FE00–$FEFF used in specific instructions during PPU mode 2.

Affected operations: `inc/dec rr`, `ld a,[hli/hld]`, `ld [hli/hld],a` (when rr in OAM range). Also: `pop`, `ret`, `push`, `call`, `rst`, interrupt handling, executing from OAM.

Objects 0 and 1 ($FE00 and $FE04) never affected.

**Write corruption** (of currently-scanned OAM row, not first row): First word = `((a^c)&(b^c))^c` (a=original word, b=first word previous row, c=third word previous row). Last three words copied from previous row.

**Read corruption**: First word = `b|(a&c)`.

---

## AUDIO (APU)

4 channels: CH1 (pulse+sweep), CH2 (pulse), CH3 (wave), CH4 (noise). APU fully synced to master clock. APU timing unaffected by CGB double speed.

NR52 bit 7 off: APU powered off, all registers cleared and read-only (except NR52 and wave RAM). ~16% power saving.

**DAC**: Channel x DAC enabled iff `NRx2 & $F8 != 0`. Exception: CH3 DAC = NR30 bit 7. DAC off → digital 0 maps to analog 1 (inverted!). Disabled DAC fades to analog 0 ("digital 7.5"). Channel ON reports in NR52 bits 0–3 (not DAC state).

**Trigger** (write NRx4 bit 7 = 1): enables channel if DAC on; resets length timer if expired; reloads period divider; resets envelope timer; sets volume from NRx2 initial.

### DIV-APU

Counter increments when DIV bit 4 goes 1→0 (512 Hz). Writing DIV while bit 4=1 advances counter early.

| Event | Every N ticks | Frequency |
|-------|---------------|-----------|
| Envelope sweep | 8 | 64 Hz |
| Sound length | 2 | 256 Hz |
| CH1 freq sweep | 4 | 128 Hz |

### Length Timer

Counts up at 256 Hz from initial value. CH1/2/4: stops at 64. CH3: stops at 256. Channel turns off when expired (if length enabled in NRx4).

### Envelope (CH1, CH2, CH4)

Ticks at 64 Hz. Every `pace` ticks, volume ±1 (direction from NRx2 bit 3). Pace=0 disables. Volume 0 does NOT turn channel off.

### Global Registers

**$FF26 NR52**: Bit 7 = APU on/off (R/W); bits 3–0 = CH4–CH1 on (read-only).

**$FF25 NR51**: Panning. Bits 7–4 = CH4–1 left; bits 3–0 = CH4–1 right. 1=channel sent to that output.

**$FF24 NR50**: Bits 6–4 = left volume (0→vol 1, 7→vol 8); bits 2–0 = right volume. Bits 7/3 = VIN panning (external audio, unused in practice).

**High-pass filter**: Applied to each analog output. Removes DC offset from DAC biasing. DMG capacitor factor ≈ 0.999958 at 4194304 Hz. Implementation:
```c
double capacitor = 0.0;
double high_pass(double in, bool dacs_enabled) {
    double out = 0.0;
    if (dacs_enabled) { out = in - capacitor; capacitor = in - out * 0.999958; }
    return out;
}
```

Audio pops occur when: DAC toggled, channel added/removed from NR51, NR50 volume changed.

### CH1 — Pulse + Sweep ($FF10–$FF14)

**$FF10 NR10**: Bits 6–4 = sweep pace (128 Hz ticks, 0=disabled but overflow check still runs); bit 3 = direction (0=increase, 1=decrease); bits 2–0 = step.

New period formula: `L_t+1 = L_t ± (L_t >> step)`. On overflow (>$7FF) in addition mode: channel off. Overflow check runs even with pace=0. Period=0 → sweep never changes it.

Sweep internals on trigger: shadow register ← period; sweep timer reset; enabled flag set if pace≠0 OR step≠0; if step≠0, frequency calc and overflow check run immediately.

**$FF11 NR11**: Bits 7–6 = duty cycle (00=12.5%, 01=25%, 10=50%, 11=75%; 25% and 75% sound identical); bits 5–0 = initial length timer (write-only).

**$FF12 NR12**: Bits 7–4 = initial volume; bit 3 = env direction (0=decrease); bits 2–0 = sweep pace. NR12&$F8=0 → DAC off.

**$FF13 NR13**: Low 8 bits of 11-bit period (write-only). Period divider: up-counter, overflows at $7FF → reload from NR13/NR14. Higher period value = lower period = higher frequency. Pulse clock: 1048576 Hz (once per 4 dots). Sample rate = 1048576/(2048-period). Tone freq = 131072/(2048-period) Hz.

**$FF14 NR14**: Bit 7 = trigger (write-only); bit 6 = length enable (R/W); bits 2–0 = period high 3 bits (write-only). Period changes take effect after current sample ends.

**Duty step**: Internal counter 0–7 indexes waveform. Resets only when APU off. Retriggering resets the step TIMER (not the step itself), potentially stalling step advance.

### CH2 — Pulse ($FF16–$FF19)

Same as CH1 but no sweep. NR21=$FF16, NR22=$FF17, NR23=$FF18, NR24=$FF19.

### CH3 — Wave ($FF1A–$FF1E, $FF30–$FF3F)

**$FF1A NR30**: Bit 7 = DAC on/off.

**$FF1B NR31**: 8-bit initial length timer (write-only). Length timer goes to 256.

**$FF1C NR32**: Bits 6–5 = output level: 00=mute, 01=100%, 10=50% (shift right 1), 11=25% (shift right 2).

**$FF1D NR33**: Low 8 bits of period (write-only). Wave clock: 2097152 Hz (once per 2 dots). Sample rate = 2097152/(2048-period). Tone freq = 65536/(2048-period) Hz. (Half that of pulse channel.) Period changes after next wave RAM read.

**$FF1E NR34**: Same layout as NR14.

**$FF30–$FF3F Wave RAM**: 16 bytes, 32 4-bit samples. Read left→right, upper nibble first. First sample played after trigger = index 1 (lower nibble of $FF30), NOT index 0.

On trigger: sample index reset but last sample in buffer NOT cleared. That last sample emitted until channel reads next one.

**Wave RAM access while CH3 active (DMG)**: Only accessible on same cycle CH3 reads. Otherwise reads $FF, writes ignored.

**DMG retriggering corruption**: If CH3 retriggers while reading a byte from wave RAM, wave RAM corrupted: if reading first 4 bytes → first byte rewritten with current read byte; if reading bytes 4–15 → first 4 bytes overwritten with the 4 aligned bytes being read. Fix: write 0 then $80 to NR30 before retrigger.

### CH4 — Noise ($FF20–$FF23)

**$FF20 NR41**: Bits 5–0 = initial length timer (write-only). Length 64.

**$FF21 NR42**: Same as NR12.

**$FF22 NR43**: Bits 7–4 = clock shift; bit 3 = LFSR width (0=15-bit, 1=7-bit); bits 2–0 = clock divider (0 treated as 0.5). LFSR frequency = 262144/(divider × 2^shift) Hz. Shift 14 or 15 → no clocking.

**$FF23 NR44**: Bit 7 = trigger; bit 6 = length enable.

**LFSR**: 16 bits (15 state + 1 temp). On each tick: bit15 = XNOR(bit0, bit1); if 7-bit mode: bit15 also copied to bit7; shift right. Bit 0 selects between 0 and current volume. Reset to 0 on trigger.

**LFSR lock-up**: If lower 7 bits all 1 when switching to 7-bit mode → LFSR generates only 1s → silence. Fix: retrigger CH4.

### APU Obscure Behavior

- Envelope/sweep timers: period 0 treated as 8.
- CH1/CH2 first duty step after first trigger: always output digital 0.
- CH1/CH2 duty cycle clocking disabled until first trigger.
- CH3 trigger: first sample = previous buffer content (high nibble); second sample = index 1 from wave RAM. First wave RAM nibble skipped until loop.
- CH1/CH2 trigger: low 2 bits of frequency timer NOT modified.
- **Extra length clocking**: Writing NRx4 when next DIV-APU step won't clock length: if length was disabled→enabled AND length non-zero → decrement. If hits 0 and trigger clear → channel off.
- If triggered when next DIV-APU step won't clock length AND length enabled AND length was 0 (now 64/256): actually set to 63/255.
- If triggered when next DIV-APU step WILL clock envelope: envelope timer loaded with value+1.
- CH1: Clearing sweep direction bit (NR10) after subtraction sweep iteration → channel immediately disabled.
- **Zombie mode** (volume write while playing): If old envelope period=0 and still auto-updating → vol+1; if decrease mode → vol+2. If mode changed → vol = 16-vol. Keep only lower 4 bits. Consistent use: write $08 to NRx2 to increment vol by 1 on all models.

---

## JOYPAD

**$FF00 P1/JOYP**:

| Bit | Function |
|-----|----------|
| 5 | Select buttons (0=select) |
| 4 | Select d-pad (0=select) |
| 3 | Start / Down |
| 2 | Select / Up |
| 1 | B / Left |
| 0 | A / Right |

Bits 0–3 are **read-only**. Pressed = **0** (active low). If neither bit 4 nor 5 selected → reads $F. Read multiple times (debounce), use last value only.

---

## SERIAL

**$FF01 SB**: Transfer data. MSB shifted out first, incoming bit shifted in from right.

**$FF02 SC**: Bit 7 = transfer enable/in-progress; bit 0 = clock select (0=external/slave, 1=internal/master).

Master: load SB, write $81 to SC. Transfer complete: SC bit 7 cleared + serial interrupt. Slave: load SB, write $80 to SC.

Internal clock (DMG): 8192 Hz (~1 KB/s). Disconnected: master reads $FF (incoming bits = 1).

---

## CARTRIDGE HEADER ($0100–$014F)

| Addr | Field |
|------|-------|
| $0100–$0103 | Entry point (typically nop + jp $0150) |
| $0104–$0133 | Nintendo logo (must match exactly or boot ROM locks; CGB only checks first half) |
| $0134–$0143 | Game title (uppercase ASCII, zero-padded; later carts: 11 or 15 chars + manufacturer + CGB flag) |
| $013F–$0142 | Manufacturer code (newer carts, 4 chars) |
| $0143 | CGB flag: $80=CGB+DMG, $C0=CGB only |
| $0144–$0145 | New licensee code (if old=$33) |
| $0146 | SGB flag ($03=SGB supported) |
| $0147 | Cartridge type (see below) |
| $0148 | ROM size: 32KiB × (1 << value) |
| $0149 | RAM size: 0=none, $02=8KiB, $03=32KiB, $04=128KiB, $05=64KiB |
| $014A | Destination: $00=Japan, $01=Overseas |
| $014B | Old licensee code ($33=use new) |
| $014C | Mask ROM version (usually $00) |
| $014D | Header checksum: sum of $0134–$014C using `chk = chk - rom[addr] - 1`. Boot ROM verifies. |
| $014E–$014F | Global checksum (16-bit big-endian, sum of all ROM bytes except this; not verified by boot ROM) |

**Cartridge type codes**: $00=ROM ONLY; $01=MBC1; $02=MBC1+RAM; $03=MBC1+RAM+BATTERY; $05=MBC2; $06=MBC2+BATTERY; $0F=MBC3+TIMER+BATTERY; $10=MBC3+TIMER+RAM+BATTERY; $11=MBC3; $12=MBC3+RAM; $13=MBC3+RAM+BATTERY; $19=MBC5; $1A=MBC5+RAM; $1B=MBC5+RAM+BATTERY; $1C=MBC5+RUMBLE; $FE=HuC3; $FF=HuC1+RAM+BATTERY

**ROM size values**: $00=32KiB(2banks), $01=64KiB(4), $02=128KiB(8), $03=256KiB(16), $04=512KiB(32), $05=1MiB(64), $06=2MiB(128), $07=4MiB(256), $08=8MiB(512)

**RAM size values**: $00=0, $02=8KiB(1bank), $03=32KiB(4banks), $04=128KiB(16banks), $05=64KiB(8banks). MBC2 built-in RAM not listed here.

---

## MBCs

MBC chips on cartridge (not in GB) handle bank switching via writes to ROM address space. Unmapped RAM bank access wraps: addr = `((addr-$A000) + bank*$2000) % max_ram_size`.

### No MBC
ROM-only ≤32KiB directly mapped $0000–$7FFF. Optional 8KiB RAM at $A000–$BFFF.

### MBC1 (max 2MiB ROM / 32KiB RAM)

Default: 512KiB ROM / 32KiB RAM. Carts ≥1MiB: 2-bit register wired as upper ROM bits (not RAM), supports up to 2MiB ROM / 8KiB RAM only.

All registers default $00 on power-up. ROM bank register 0 → treated as 1.

| Range | Register | Notes |
|-------|----------|-------|
| $0000–$1FFF | RAM Enable (W) | Write $xA → enable; anything else → disable |
| $2000–$3FFF | ROM Bank (W) | 5-bit ($01–$1F); 0→1; masked to needed bits |
| $4000–$5FFF | RAM Bank / Upper ROM bits (W) | 2-bit; selects RAM bank 0–3 OR ROM upper bits |
| $6000–$7FFF | Banking Mode (W) | 0=simple (default): $0000–$3FFF and $A000–$BFFF locked to bank 0; 1=advanced: allow bank switching in all regions |

Banks $20/$40/$60 inaccessible in 4000–7FFF (lower 5 bits=0 → treated as 1); use mode 1 + $0000 region to access. **MBC1M** (multi-cart): 4-bit main register, 2-bit register = bits 4–5 of bank number, selects $00/$10/$20/$30 in mode 1.

### MBC2 (max 256KiB ROM / 512×4bits RAM)

RAM built into MBC chip. Only lower 4 bits of A000–A1FF valid; upper 4 undefined. A200–BFFF echoes A000–A1FF (9-bit address).

| Range | Register | Notes |
|-------|----------|-------|
| $0000–$3FFF | RAM Enable OR ROM Bank (W) | Determined by address bit 8 |

Address bit 8 (LSB of high address byte): 0 = RAM enable ($xA enables, else disable); 1 = ROM bank select (low 4 bits, 0→1).

### MBC3 (max 2MiB ROM / 32KiB RAM + RTC)

7-bit ROM bank register; all 128 banks accessible (unlike MBC1, no gaps at $20/$40/$60). Requires 32.768 kHz crystal + battery for RTC.

| Range | Register | Notes |
|-------|----------|-------|
| $0000–$1FFF | RAM+Timer Enable (W) | $0A=enable, $00=disable |
| $2000–$3FFF | ROM Bank (W) | 7-bit, 0→1 |
| $4000–$5FFF | RAM Bank / RTC Select (W) | $00–$07=RAM bank; $08–$0C=RTC register |
| $6000–$7FFF | Latch Clock (W) | Write $00 then $01 to latch RTC into registers |

**RTC registers** (accessible via $A000–$BFFF when selected):
- $08 = seconds (0–59)
- $09 = minutes (0–59)
- $0A = hours (0–23)
- $0B = day counter low 8 bits
- $0C = day counter high: bit 0=day MSB, bit 6=halt (1=stop), bit 7=carry (overflow)

Set halt flag before writing RTC. Day counter 0–511; overflow sets carry (stays set until program clears). Wait 4 µs between RTC accesses.

---

## BOOT ROM / POWER-UP

CPU starts at $0000 (boot ROM mapped over cartridge). Boot ROM:
1. Scrolls Nintendo logo (reads from cartridge header).
2. Plays "ba-ding!" sound.
3. Checks logo matches hardcoded copy → lockup if fail.
4. Checks header checksum ($014D) → lockup if fail.
5. Writes to $FF50 (BANK register) to unmap boot ROM.
6. First cartridge instruction at $0100.

**DMG register state at $0100**: A=$01, F=Z=1 N=0 H=? C=?(based on header checksum), B=$00, C=$13, D=$00, E=$D8, H=$01, L=$4D, SP=$FFFE, IE=$00, IF=$E1.

OBP0 and OBP1 are **uninitialized** — always set these before displaying OBJs.

Key hardware register states (DMG): LCDC=$91, BGP=$FC, SCY/SCX=$00, LYC=$00, DIV=$AB, TAC=$F8, NR50=$77, NR51=$F3, NR52=$F1.

---

## HALT / STOP (Power Saving)

**HALT**: CPU pauses until IE&IF≠0. Best used while waiting for VBlank:
```rgbasm
halt  ; CPU sleeps, wakes on any enabled interrupt
```
Extends battery life 5–50%.

**STOP**: Very low power standby. DMG: disable LCD first (or hardware damage). Terminated by button press. Configure P1 to enable desired buttons before STOP. No licensed ROM uses STOP outside CGB speed switching.

**APU off**: Write $00 to NR52 → ~16% power saving. Re-enable: write $80, then re-initialize all sound registers.

$ARGUMENTS
