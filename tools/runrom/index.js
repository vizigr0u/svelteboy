import {
    loadCartridgeRom,
    loadBootRom, runFrames, initEmulator, setVerbose,
    // serialEnableLog, dumpLogToConsole
} from "../../build/backend.js";

import { open } from 'node:fs/promises';

const DEFAULT_VERBOSE = 4;

let verbose = DEFAULT_VERBOSE;

let args = process.argv;

const benchmark = args.includes('--benchmark');

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
    const t0 = performance.now();
    const frames = 5000;
    runFrames(frames);
    const t1 = performance.now();
    console.log(`time: ${frames} frames in ${t1 - t0}ms = ${(frames * 1000) / (t1 - t0)} FPS`);
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
