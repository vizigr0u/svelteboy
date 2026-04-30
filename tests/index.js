import { suite, test, printTotals } from "./framework.js";
import backend from "../scripts/loadBackendNode.mjs";
import { testBlargg02Interrupts } from "./blargg.js";

console.log("Total memory size: " + backend.TOTAL_MEMORY_SIZE);

backend.dumpLogToConsole();
backend.resetCpuTestSession();

// Sort by name so test order is stable regardless of how the backend is loaded
// (ESM `* as` namespace iterates alphabetically; a plain object literal iterates
// in insertion order, which would expose pre-existing inter-test state bleed).
const testFns = Object.entries(backend)
    .filter(([name]) => /^test[A-Z]/.test(name))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([, fn]) => fn);

suite('WASM', () => {
    testFns.forEach(fn => test(fn));
});

suite('Integration', () => {
    test(testBlargg02Interrupts);
});

printTotals();

console.log(backend.getCpuTestSessionSummary());