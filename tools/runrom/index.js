import {
    loadCartridgeRom,
    loadBootRom, runFrames, initEmulator, setVerbose, instrumentedDiag,
    // serialEnableLog, dumpLogToConsole
} from "../../build/backend.js";

import { open, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';

let args = process.argv.filter(a => a !== '--');

const tty = process.stdout.isTTY;
const benchmark = args.includes('--benchmark');
const profile = args.includes('--profile');
const withInstrumentations = args.includes('--instrumented');
const profileFnIndex = args.indexOf('--profile-function');
const profileFn = profileFnIndex >= 0 ? args[profileFnIndex + 1] : null;

if (benchmark) {
    args = args.filter(a => a != '--benchmark');
}
if (profile || profileFn) {
    args = args.filter(a => a != '--profile');
}
if (profileFn) {
    args = args.filter((_, i) => i != profileFnIndex && i != profileFnIndex + 1);
}

const verboseIndex = args.indexOf('--verbose');
if (verboseIndex >= 0 && verboseIndex < args.length - 1 && !isNaN(Number(args[verboseIndex + 1]))) {
    setVerbose(Number(args[verboseIndex + 1]));
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

const PROGRESS_CHUNK = 150;

function runChunked(totalFrames, onChunk) {
    let done = 0;
    while (done < totalFrames) {
        const chunk = Math.min(PROGRESS_CHUNK, totalFrames - done);
        runFrames(chunk);
        done += chunk;
        if (tty) onChunk(done, totalFrames);
    }
    if (tty) process.stdout.write('\n');
}

function analyzeProfile(profile, topN = 5) {
    const totalSamples = profile.samples.length;
    const totalUs = profile.timeDeltas.reduce((a, b) => a + b, 0);
    const usPerSample = totalUs / totalSamples;

    const selfHits = new Map();
    for (const id of profile.samples)
        selfHits.set(id, (selfHits.get(id) || 0) + 1);

    const nodeMap = new Map(profile.nodes.map(n => [n.id, n]));

    const rows = [];
    for (const [id, hits] of selfHits) {
        const node = nodeMap.get(id);
        if (!node) continue;
        const name = node.callFrame.functionName || '(anonymous)';
        if (name === '(idle)') continue;
        const loc = node.callFrame.url.replace(/^wasm:\/\/[^/]+\//, 'wasm:');
        const selfMs = (hits * usPerSample) / 1000;
        const pct = (hits / totalSamples * 100).toFixed(1);
        rows.push({ name, loc, selfMs, pct });
    }

    rows.sort((a, b) => b.selfMs - a.selfMs);
    console.log(`\nTop ${topN} by self time (${(totalUs / 1000).toFixed(0)}ms total):`);
    for (const r of rows.slice(0, topN))
        console.log(`  ${r.pct.padStart(5)}%  ${r.selfMs.toFixed(1).padStart(7)}ms  ${r.name}  ${r.loc}`);
}

function analyzeFunctionRatio(profile, fnName) {
    const nodeMap = new Map(profile.nodes.map(n => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes)
        for (const c of (n.children || []))
            parent.set(c, n.id);

    function isInStack(nodeId, name) {
        let cur = nodeId;
        while (cur != null) {
            if ((nodeMap.get(cur)?.callFrame?.functionName || '').includes(name)) return true;
            const p = parent.get(cur);
            if (p == null || p === cur) break;
            cur = p;
        }
        return false;
    }

    const total = profile.samples.length;
    let fnSamples = 0, parentSamples = 0;
    // auto-detect parent: first ancestor function whose name differs from fnName
    const parentCandidates = new Map();
    for (const s of profile.samples) {
        if (!isInStack(s, fnName)) continue;
        fnSamples++;
        // walk up to find direct parent function
        let cur = parent.get(s);
        while (cur != null) {
            const name = nodeMap.get(cur)?.callFrame?.functionName || '';
            if (name && name !== '(anonymous)' && name !== '(idle)' && !name.includes(fnName)) {
                parentCandidates.set(name, (parentCandidates.get(name) || 0) + 1);
                break;
            }
            const p = parent.get(cur);
            if (p == null || p === cur) break;
            cur = p;
        }
    }

    // pick most common parent
    let parentName = null, parentCount = 0;
    for (const [name, count] of parentCandidates)
        if (count > parentCount) { parentName = name; parentCount = count; }

    if (parentName)
        for (const s of profile.samples)
            if (isInStack(s, parentName)) parentSamples++;

    const totalUs = profile.timeDeltas.reduce((a, b) => a + b, 0);
    const usPerSample = totalUs / total;
    const fnMs = (fnSamples * usPerSample / 1000).toFixed(1);
    const parentMs = parentName ? (parentSamples * usPerSample / 1000).toFixed(1) : '?';
    const fnPct = (fnSamples / total * 100).toFixed(1);
    const parentPct = parentName ? (parentSamples / total * 100).toFixed(1) : '?';
    const ratio = parentSamples > 0 ? (fnSamples / parentSamples * 100).toFixed(1) + '%' : 'N/A';

    console.log(`\nFunction ratio analysis: "${fnName}"`);
    console.log(`  ${fnName.split('/').pop()}: ${fnSamples} samples, ${fnMs}ms (${fnPct}% of total)`);
    if (parentName) {
        console.log(`  Parent "${parentName.split('/').pop()}": ${parentSamples} samples, ${parentMs}ms (${parentPct}% of total)`);
        console.log(`  Ratio ${fnName.split('/').pop()} / parent: ${ratio}`);
    } else {
        console.log(`  No parent found`);
    }
}

async function runProfile(fnName = null) {
    const frames = 1500;
    const outFile = 'profile.cpuprofile';
    const session = new Session();
    session.connect();
    await session.post('Profiler.enable');
    await session.post('Profiler.start');
    const steps = 4;
    const stepSize = Math.ceil(frames / steps);
    let nextStep = stepSize;
    runChunked(frames, (done, total) => {
        if (done >= nextStep || done === total) {
            const pct = Math.min(100, Math.round(done / total * 100));
            process.stdout.write(`\rProfiling: ${pct}%`);
            nextStep += stepSize;
        }
    });
    const { profile } = await session.post('Profiler.stop');
    await writeFile(outFile, JSON.stringify(profile));
    if (fnName) {
        analyzeFunctionRatio(profile, fnName);
    } else {
        analyzeProfile(profile);
        console.log(`\nProfile written to ${outFile} — drag onto speedscope.app for flame graph`);
    }
    if (withInstrumentations) {
        instrumentedDiag();
    }
}

function runBenchmark() {
    const frames = 1500;
    const iterations = 10;
    let avg = 0;
    let low = 0;
    let max = Number.POSITIVE_INFINITY;

    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        runChunked(frames, (done, total) => {
            process.stdout.write(`\rIteration ${i + 1}/${iterations}: ${done}/${total} frames`);
        });
        const time = performance.now() - t0;
        avg += time / iterations;
        low = Math.max(low, time);
        max = Math.min(max, time);
    }
    const fmt = (n) => ((frames * 1000) / n).toFixed(1);
    console.log(`Avg: ${fmt(avg)}, Low: ${fmt(low)}, High: ${fmt(max)}`);
}

Promise.all(promises).then(async result => {
    loadBootRom(result[0]);
    loadCartridgeRom(result[1]);
    initEmulator();
    if (profileFn) {
        await runProfile(profileFn);
    } else if (profile) {
        await runProfile();
    } else if (benchmark) {
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
