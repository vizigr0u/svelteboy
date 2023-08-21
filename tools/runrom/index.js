import {
    runCartridge, loadCartridgeRom, loadBootRom, runOneFrame, init, setVerbose, serialEnableLog, dumpLogToConsole
} from "../../build/release.js";

import { open } from 'node:fs/promises';

const DEFAULT_VERBOSE = 4;
let verbose = DEFAULT_VERBOSE;

// import { parseArgs } from "node:util";

// const {
//     values: { benchmark, verbose: verboseStr }, positionals
// } = parseArgs({
//     options: {
//         verbose: {
//             type: "string",
//             short: "v",
//             default: DEFAULT_VERBOSE.toString()
//         },
//         benchmark: {
//             type: "boolean"
//         },
//     },
// });

// console.log(`Bench: ${benchmark}, verbose: ${verboseStr}, positionals: ${JSON.stringify(positionals)}"`)
// process.exit(0)

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
    init();
    const t0 = performance.now();
    const frames = 800;
    for (let i = 0; i < frames; i++)
        runOneFrame();
    const t1 = performance.now();
    console.log(`time: ${frames} frames in ${t1 - t0}ms = ${(frames * 1000) / (t1 - t0)} FPS`);
}

Promise.all(promises).then(result => {
    loadBootRom(result[0]);
    loadCartridgeRom(result[1]);
    if (benchmark) {
        runBenchmark();
    } else {
        serialEnableLog(true);
        dumpLogToConsole(true);
        runCartridge();
    }

    bootFile.close();
    cartFile.close();
});

// resetCpuTestSession();
// console.log(getCpuTestSessionSummary());
