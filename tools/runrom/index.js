import {
    loadCartridgeRom,
    loadBootRom, runFrames, initEmulator, setVerbose,
    // serialEnableLog, dumpLogToConsole
} from "../../build/backend.js";

import { open } from 'node:fs/promises';

const DEFAULT_VERBOSE = 4;

let verbose = DEFAULT_VERBOSE;

let args = process.argv;

const interactive = args.includes('--interactive');

const benchmark = args.includes('--benchmark');

if (interactive) {
    args = args.filter(a => a != '--interactive');
}
if (benchmark) {
    args = args.filter(a => a != '--benchmark');
}

const verboseIndex = args.indexOf('--verbose');
if (verboseIndex >= 0 && verboseIndex < args.length - 1 && !isNaN(Number(args[verboseIndex + 1]))) {
    verbose = Number(args[verboseIndex + 1]);
    args = args.filter((_, index) => index != verboseIndex && index != verboseIndex + 1);
}

if (args.length < 4) {
    console.log('usage: ' + args[0] + ' bootfile.bin romfile.gb');
    process.exit(-1);
}

const bootFile = await open(args[2]);
const cartFile = await open(args[3]);

const promises = [bootFile.readFile(), cartFile.readFile()];

setVerbose(0);

function runBenchmark() {
    const frames = 1500;
    const iterations = 10;
    // init low, avg and max
    let avg = 0;
    let low = 0;
    let max = Number.POSITIVE_INFINITY;

    for (let i = 0; i < iterations; i++)
    {
        const t0 = performance.now();
        runFrames(frames);
        const time = performance.now() - t0;
        avg += time / iterations;
        low = Math.max(low, time);
        max = Math.min(max, time);
        if (interactive) {
            console.log(`Iteration ${i + 1} - Time: ${time.toFixed(2)} ms (FPS: ${(frames * 1000) / time})`);
        }
    }
    console.log(`Avg: ${(frames * 1000) / avg}, Low: ${(frames * 1000) / low}, High: ${(frames * 1000) / max}`);
}

Promise.all(promises).then(result => {
    loadBootRom(result[0]);
    loadCartridgeRom(result[1]);
    initEmulator();
    if (benchmark) {
        runBenchmark();
    } else {
        console.log('Disabled, needs reimplementing, use --benchmark');
        // serialEnableLog(true);
        // dumpLogToConsole(true);
    }

    bootFile.close();
    cartFile.close();
});

// resetCpuTestSession();
// console.log(getCpuTestSessionSummary());
