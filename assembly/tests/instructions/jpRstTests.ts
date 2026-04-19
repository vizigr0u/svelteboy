import { Cpu, Flag } from "../../cpu/cpu";
import { Emulator } from "../../emulator";
import { setTestRom } from "../cpuTests";
import { describe, it, assertEquals, assertCycles } from "../framework";

// ── RST ──────────────────────────────────────────────────────────────────────

function RunRst(opCode: u8, vector: u16): void {
    setTestRom([opCode]);
    Cpu.StackPointer = 0xFFFE;
    Cpu.Tick();
    assertCycles(16);
    assertEquals<u16>(Cpu.ProgramCounter, vector, "PC");
    assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
    assertEquals<u16>(Cpu.PopSP(), 0x0001, "return addr");
}

function testRstVariants(): void {
    describe("RST", () => {
        it("RST 00 (0xC7)", () => { RunRst(0xC7, 0x00); });
        it("RST 08 (0xCF)", () => { RunRst(0xCF, 0x08); });
        it("RST 10 (0xD7)", () => { RunRst(0xD7, 0x10); });
        it("RST 18 (0xDF)", () => { RunRst(0xDF, 0x18); });
        it("RST 20 (0xE7)", () => { RunRst(0xE7, 0x20); });
        it("RST 28 (0xEF)", () => { RunRst(0xEF, 0x28); });
        it("RST 30 (0xF7)", () => { RunRst(0xF7, 0x30); });
        it("RST 38 (0xFF)", () => { RunRst(0xFF, 0x38); });
    });
}

// ── JP ───────────────────────────────────────────────────────────────────────

function RunJp(opCode: u8, dest: u16, flags: u8): void {
    setTestRom([opCode, <u8>(dest & 0xFF), <u8>(dest >> 8)]);
    Cpu.SetF(flags);
    Cpu.Tick();
}

function testJpVariants(): void {
    describe("JP", () => {
        it("JP nn unconditional", () => {
            RunJp(0xC3, 0xBEEF, 0);
            assertCycles(16);
            assertEquals<u16>(Cpu.ProgramCounter, 0xBEEF, "PC");
        });

        it("JP HL", () => {
            setTestRom([0xE9]);
            Cpu.HL = 0x1234;
            Cpu.Tick();
            assertCycles(4);
            assertEquals<u16>(Cpu.ProgramCounter, 0x1234, "PC");
        });

        it("JP NZ taken (Z clear)", () => {
            RunJp(0xC2, 0x1234, 0);
            assertCycles(16);
            assertEquals<u16>(Cpu.ProgramCounter, 0x1234, "PC");
        });
        it("JP NZ not taken (Z set)", () => {
            RunJp(0xC2, 0x1234, <u8>Flag.Z_Zero);
            assertCycles(12);
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });

        it("JP Z taken (Z set)", () => {
            RunJp(0xCA, 0x1234, <u8>Flag.Z_Zero);
            assertCycles(16);
            assertEquals<u16>(Cpu.ProgramCounter, 0x1234, "PC");
        });
        it("JP Z not taken (Z clear)", () => {
            RunJp(0xCA, 0x1234, 0);
            assertCycles(12);
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });

        it("JP NC taken (C clear)", () => {
            RunJp(0xD2, 0x5678, 0);
            assertCycles(16);
            assertEquals<u16>(Cpu.ProgramCounter, 0x5678, "PC");
        });
        it("JP NC not taken (C set)", () => {
            RunJp(0xD2, 0x5678, <u8>Flag.C_Carry);
            assertCycles(12);
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });

        it("JP C taken (C set)", () => {
            RunJp(0xDA, 0x5678, <u8>Flag.C_Carry);
            assertCycles(16);
            assertEquals<u16>(Cpu.ProgramCounter, 0x5678, "PC");
        });
        it("JP C not taken (C clear)", () => {
            RunJp(0xDA, 0x5678, 0);
            assertCycles(12);
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });
    });
}

// ── STOP ─────────────────────────────────────────────────────────────────────

function testStopInstruction(): void {
    describe("STOP", () => {
        it("STOP sets isStopped", () => {
            setTestRom([0x10, 0x00]);
            assert(!Cpu.isStopped, "should not be stopped before STOP");
            Cpu.Tick();
            assert(Cpu.isStopped, "isStopped after STOP");
        });
        it("STOP keeps CPU stopped after further ticks", () => {
            setTestRom([0x10, 0x00, 0x00, 0x00]);
            Cpu.Tick();
            assert(Cpu.isStopped, "still stopped after 1st tick");
            Emulator.Tick();
            assert(Cpu.isStopped, "still stopped after Emulator.Tick()");
        });
    });
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function testJpRst(): boolean {
    testRstVariants();
    testJpVariants();
    testStopInstruction();
    return true;
}
