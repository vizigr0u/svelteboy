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
    setVerbose,
    testPixelFifo,
    testUint4Array
} from "../build/backend.js";

console.log("Total memory size: " + TOTAL_MEMORY_SIZE);

function colorString(str, colorCode) {
    return '\u001b[' + colorCode + 'm' + str + '\u001b[0m';
}

const okString = colorString('✓', 92);
const failString = colorString('✖', 91);
const ignoreString = colorString('-', 93);

function test(testableFunc, ignored = false) {
    if (ignored) {
        console.log(ignoreString + ' ' + testableFunc.name + ' (ignored)');
        return;
    }
    const result = testableFunc();
    console.log((result ? okString : failString) + ' ' + colorString(testableFunc.name, result ? 32 : 31));
}

dumpLogToConsole();

test(testUint4Array);

resetCpuTestSession();

test(testVideo);

test(testRegisters);

test(testMemory);

test(testCpu);

test(testNop);

test(testInstructions);

test(testPrograms);

test(testMisc);

test(testFifo);

test(testPixelFifo);

console.log(getCpuTestSessionSummary());
