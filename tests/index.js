import { suite, test, printTotals } from "./framework.js";

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

suite('Data Structures', () => {
    test(testUint4Array);
    test(testFifo);
    test(testPixelFifo);
});

suite('CPU', () => {
    test(testRegisters);
    test(testCpu);
    test(testNop);
    test(testInstructions);
    test(testPrograms);
    test(testInterrupts);
});

suite('Memory', () => {
    test(testMemory);
});

suite('Video', () => {
    test(testVideo);
    test(testMisc);
});

suite('Integration', () => {
    test(testBlargg02Interrupts);
});

console.log(getCpuTestSessionSummary());
printTotals();
