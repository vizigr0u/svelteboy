import { Cpu } from "../cpu/cpu";
import { MemoryMap } from "../memory/memoryMap";

let _suite: string = "";
let _case: string = "";
let _beforeEachFn: (() => void) | null = null;
let _afterEachFn: (() => void) | null = null;

export function describe(name: string, fn: () => void): void {
    const prev = _suite;
    const prevBeforeEach = _beforeEachFn;
    const prevAfterEach = _afterEachFn;
    _suite = name;
    _beforeEachFn = null;
    _afterEachFn = null;
    fn();
    _suite = prev;
    _beforeEachFn = prevBeforeEach;
    _afterEachFn = prevAfterEach;
}

export function beforeEach(fn: () => void): void {
    _beforeEachFn = fn;
}

export function afterEach(fn: () => void): void {
    _afterEachFn = fn;
}

export function it(name: string, fn: () => void): void {
    _case = name;
    if (_beforeEachFn !== null) _beforeEachFn!();
    fn();
    if (_afterEachFn !== null) _afterEachFn!();
    _case = "";
}

export function ctx(): string {
    if (_suite.length > 0 && _case.length > 0) return `[${_suite} › ${_case}] `;
    if (_case.length > 0) return `[${_case}] `;
    if (_suite.length > 0) return `[${_suite}] `;
    return "";
}

export function assertEquals<T>(actual: T, expected: T, label: string = ""): void {
    assert(actual == expected,
        `${ctx()}${label.length > 0 ? label + ": " : ""}expected ${expected}, got ${actual}`);
}

export function assertNotEquals<T>(actual: T, unexpected: T, label: string = ""): void {
    assert(actual != unexpected,
        `${ctx()}${label.length > 0 ? label + ": " : ""}expected not ${unexpected}, got ${actual}`);
}

export function assertCycles(expected: u64): void {
    assertEquals<u64>(Cpu.CycleCount, expected, "cycles");
}

export function assertFlags(z: bool, n: bool, h: bool, c: bool): void {
    assert(Cpu.FlagZ() == z, `${ctx()}Z: expected ${z}, got ${Cpu.FlagZ()}`);
    assert(Cpu.FlagN() == n, `${ctx()}N: expected ${n}, got ${Cpu.FlagN()}`);
    assert(Cpu.FlagH() == h, `${ctx()}H: expected ${h}, got ${Cpu.FlagH()}`);
    assert(Cpu.FlagC() == c, `${ctx()}C: expected ${c}, got ${Cpu.FlagC()}`);
}

export function assertReg(actual: u8, expected: u8, name: string): void {
    assertEquals<u8>(actual, expected, name);
}

export function assertMem(addr: u16, expected: u8): void {
    assertEquals<u8>(MemoryMap.GBload<u8>(addr), expected, `mem[0x${addr.toString(16)}]`);
}
