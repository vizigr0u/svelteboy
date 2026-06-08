import { Cartridge } from "../cartridge";
import { CartridgeType } from "../metadata";
import { Emulator } from "../emulator";
import { Lcd } from "../io/video/lcd";
import { Ppu, PpuMode } from "../io/video/ppu";
import { MBC3 } from "../memory/mbc3";
import { MBC3RTC } from "../memory/mbc3rtc";
import { MemoryMap } from "../memory/memoryMap";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { createSaveState, loadSaveState, SAVESTATE_VERSION } from "../savestate";
import { describe, it, assertEquals } from "./framework";

function setupCart(type: CartridgeType): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x80000); // 32 banks worth
    MemoryMap.loadedCartridgeRomSize = 0x80000;
    Cartridge.Data.cartridgeType = type;
    Cartridge.Data.romSizeByte = 4; // 32 banks
    Cartridge.Data.ramSizeByte = 3; // 4 banks
    Emulator.Init(false);
    Ppu.currentMode = PpuMode.VBlank;
    Lcd.data.lY = 144;
}

function setupRtcCart(): void {
    setupCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2);
}

function setupNonRtcCart(): void {
    setupCart(CartridgeType.MBC3_RAM_BATTERY_2);
}

export function testMbc3RtcSaveState(): boolean {
    describe("SaveState v6 - MBC3 RTC", () => {

        it("SAVESTATE_VERSION is 6", () => {
            assertEquals<u16>(SAVESTATE_VERSION, 6, "version 6");
        });

        it("round-trip preserves live S/M/H/DL", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.SetRealTimeSec(86400 * 2 + 3 * 3600 + 4 * 60 + 5);
            MBC3RTC.Update();
            const liveS = MBC3RTC.Live(0);
            const liveM = MBC3RTC.Live(1);
            const liveH = MBC3RTC.Live(2);
            const liveDL = MBC3RTC.Live(3);

            const state = createSaveState();
            assert(state.byteLength > 0, "non-empty save");

            // Corrupt live state
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            assertEquals<u8>(MBC3RTC.Live(0), 0, "live cleared by Init");

            // Reload at same real time as save
            MBC3RTC.SetRealTimeSec(86400 * 2 + 3 * 3600 + 4 * 60 + 5);
            assert(loadSaveState(state), "load failed");
            assertEquals<u8>(MBC3RTC.Live(0), liveS, "S restored");
            assertEquals<u8>(MBC3RTC.Live(1), liveM, "M restored");
            assertEquals<u8>(MBC3RTC.Live(2), liveH, "H restored");
            assertEquals<u8>(MBC3RTC.Live(3), liveDL, "DL restored");
        });

        it("round-trip preserves halt flag", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.WriteReg(4, 0x40); // halt
            const state = createSaveState();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            assertEquals<bool>(MBC3RTC.Halted, false, "halt cleared by Init");
            assert(loadSaveState(state), "load failed");
            assertEquals<bool>(MBC3RTC.Halted, true, "halt restored");
        });

        it("round-trip preserves carry flag", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.WriteReg(4, 0x80); // carry
            const state = createSaveState();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            assertEquals<bool>(MBC3RTC.Carry, false, "carry cleared by Init");
            assert(loadSaveState(state), "load failed");
            assertEquals<bool>(MBC3RTC.Carry, true, "carry restored");
        });

        it("round-trip preserves latched regs", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.SetRealTimeSec(125);
            MBC3RTC.Latch();
            const state = createSaveState();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            assertEquals<u8>(MBC3RTC.Latched(0), 0, "latched cleared");
            MBC3RTC.SetRealTimeSec(125);
            assert(loadSaveState(state), "load failed");
            assertEquals<u8>(MBC3RTC.Latched(0), 5, "latched S = 5");
            assertEquals<u8>(MBC3RTC.Latched(1), 2, "latched M = 2");
        });

        it("halted save: elapsed wall time does NOT advance live regs", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.SetRealTimeSec(30);
            MBC3RTC.Update();
            MBC3RTC.WriteReg(4, 0x40); // halt
            const state = createSaveState();
            // Reload 10 minutes later
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.SetRealTimeSec(30 + 600);
            assert(loadSaveState(state), "load failed");
            assertEquals<u8>(MBC3RTC.Live(0), 30, "S still 30 (halted)");
            assertEquals<u8>(MBC3RTC.Live(1), 0, "M still 0");
        });

        it("unhalted save: elapsed wall time advances live on reload", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(1_000_000);
            MBC3RTC.Init();
            MBC3RTC.SetRealTimeSec(1_000_010);
            MBC3RTC.Update();
            const state = createSaveState();
            // Reload 60s later
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3RTC.SetRealTimeSec(1_000_070);
            assert(loadSaveState(state), "load failed");
            assertEquals<u8>(MBC3RTC.Live(0), 10, "S = 10");
            assertEquals<u8>(MBC3RTC.Live(1), 1, "M = 1");
        });

        it("non-RTC cart: save state has no RTC block (smaller)", () => {
            setupRtcCart();
            const rtcState = createSaveState();
            const rtcSize = rtcState.byteLength;
            setupNonRtcCart();
            const noRtcState = createSaveState();
            const noRtcSize = noRtcState.byteLength;
            assertEquals<i32>(rtcSize - noRtcSize, 50, "RTC block adds 50 bytes (48 BGB + 2 MBC3 tail)");
        });

        it("round-trip preserves MBC3.rtcSelect (current RTC register selection)", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3.rtcSelect = 2; // RTC hours selected ($0A)
            const state = createSaveState();
            MBC3.rtcSelect = -1; // game writes RAM bank, clears RTC select
            assert(loadSaveState(state), "load failed");
            assertEquals<i32>(MBC3.rtcSelect, 2, "rtcSelect restored");
        });

        it("round-trip preserves MBC3.latchPrev (in-progress latch sequence)", () => {
            setupRtcCart();
            MBC3RTC.SetRealTimeSec(0);
            MBC3RTC.Init();
            MBC3.latchPrev = 0; // game wrote 0 to $6000, awaiting 1
            const state = createSaveState();
            MBC3.latchPrev = 0xFF; // any other value
            assert(loadSaveState(state), "load failed");
            assertEquals<u8>(MBC3.latchPrev, 0, "latchPrev restored");
        });
    });

    return true;
}
