import { test } from "./framework.js";

import {
    testRegisters,
    testMemory,
    TOTAL_MEMORY_SIZE,
    testCpu,
    testInstructions,
    testNop,
    testPrograms,
    resetCpuTestSession,
    getCpuTestSessionSummary,
    testVideo,
    testMisc,
    testFifo,
    dumpLogToConsole,
    testPixelFifo,
    testUint4Array,
    testInterrupts,
} from "../build/backend.js";

import { testBlargg02Interrupts } from "./blargg.js";


console.log("Total memory size: " + TOTAL_MEMORY_SIZE);

dumpLogToConsole();
resetCpuTestSession();

const tests = [
    testUint4Array,
    testVideo,
    testRegisters,
    testMemory,
    testCpu,
    testNop,
    testInstructions,
    testPrograms,
    testMisc,
    testFifo,
    testPixelFifo,
    testInterrupts,
    testTimer,
    testBlargg02Interrupts,
];

tests.forEach(fn => test(fn));

console.log(getCpuTestSessionSummary());
