import { suite, test, printTotals } from "./framework.js";
import * as backend from "../build/backend.debug.js";

console.log("Total memory size: " + backend.TOTAL_MEMORY_SIZE);

backend.dumpLogToConsole();
backend.resetCpuTestSession();

const testFns = Object.entries(backend)
    .filter(([name]) => /^test[A-Z]/.test(name))
    .map(([, fn]) => fn);

suite('WASM', () => {
    testFns.forEach(fn => test(fn));
});

console.log(backend.getCpuTestSessionSummary());

printTotals();