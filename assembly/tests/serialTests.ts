import { MemoryMap } from "../memory/memoryMap";
import { Interrupt } from "../cpu/interrupts";
import { setTestRom } from "./cpuTests";
import { describe, it, assertEquals } from "./framework";

const SB: u16 = 0xFF01;
const SC: u16 = 0xFF02;
const IF: u16 = 0xFF0F;

function setupSerial(): void {
    setTestRom([0x00]);
    MemoryMap.GBstore<u8>(IF, 0x00);
}

// SC bit 7 = transfer enable/in-progress; must clear after transfer completes
function testScStartBitClears(): void {
    setupSerial();
    MemoryMap.GBstore<u8>(SB, 0x42);
    MemoryMap.GBstore<u8>(SC, 0x81); // start transfer, internal clock
    const sc = MemoryMap.GBload<u8>(SC);
    assertEquals<u8>(sc & 0x80, 0, "SC bit 7 must clear after transfer completes");
}

// SC bit 0 = clock source: 0=external (slave), 1=internal (master).
// External clock: no device drives the clock, transfer never completes, no interrupt.
function testScExternalClockNoInterrupt(): void {
    setupSerial();
    MemoryMap.GBstore<u8>(SB, 0x42);
    MemoryMap.GBstore<u8>(SC, 0x80); // bit 7 set, bit 0 = 0 (external/slave)
    const ifReg = MemoryMap.GBload<u8>(IF);
    assertEquals<u8>(ifReg & 0x08, 0, "External clock (SC=0x80): serial IF bit must NOT be set");
}

// SC bit 0=0: SC bit 7 stays set (transfer not started without internal clock)
function testScExternalClockBit7Stays(): void {
    setupSerial();
    MemoryMap.GBstore<u8>(SC, 0x80);
    const sc = MemoryMap.GBload<u8>(SC);
    assertEquals<u8>(sc & 0x80, 0x80, "External clock: SC bit 7 must remain set (transfer pending)");
}

// IF bit 3 = serial interrupt; must be set when internal-clock transfer completes
function testTransferCompleteInterrupt(): void {
    setupSerial();
    MemoryMap.GBstore<u8>(SB, 0x42);
    MemoryMap.GBstore<u8>(SC, 0x81);
    const ifReg = MemoryMap.GBload<u8>(IF);
    assertEquals<u8>(ifReg & 0x08, 0x08, "IF bit 3 must be set after serial transfer completes");
}

// SB is R/W; written value must be readable when no transfer active
function testSbReadWrite(): void {
    setupSerial();
    MemoryMap.GBstore<u8>(SB, 0xAB);
    assertEquals<u8>(MemoryMap.GBload<u8>(SB), 0xAB, "SB must return written value");
    MemoryMap.GBstore<u8>(SB, 0x00);
    assertEquals<u8>(MemoryMap.GBload<u8>(SB), 0x00, "SB must update on write");
}

// Pan Docs: "Disconnected: master reads $FF (incoming bits = 1)"
// After a transfer with no device connected, SB should contain $FF
function testSbReceivesFFWhenDisconnected(): void {
    setupSerial();
    MemoryMap.GBstore<u8>(SB, 0x42);
    MemoryMap.GBstore<u8>(SC, 0x81);
    assertEquals<u8>(MemoryMap.GBload<u8>(SB), 0xFF,
        "SB must read $FF after disconnected transfer (no external device)");
}

export function testSerial(): boolean {
    describe("Serial", () => {
        it("SC bit 7 clears after internal-clock transfer", () => { testScStartBitClears(); });
        it("SC bit 0=0 (external clock) does not trigger interrupt", () => { testScExternalClockNoInterrupt(); });
        it("SC bit 0=0 (external clock) SC bit 7 stays set", () => { testScExternalClockBit7Stays(); });
        it("IF bit 3 set after internal-clock transfer completes", () => { testTransferCompleteInterrupt(); });
        it("SB read/write", () => { testSbReadWrite(); });
        it("SB reads $FF after disconnected transfer", () => { testSbReceivesFFWhenDisconnected(); });
    });
    return true;
}
