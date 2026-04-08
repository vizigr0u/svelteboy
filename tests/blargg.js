import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
    initEmulator,
    runFrames,
    loadCartridgeRom,
    getDebugInfo,
    serialEnableLog,
} from "../build/backend.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runBlarggRom(romPath, maxFrames = 1000) {
    const rom = readFileSync(romPath);
    loadCartridgeRom(rom.buffer.slice(rom.byteOffset, rom.byteOffset + rom.byteLength));
    initEmulator(false);
    serialEnableLog(false);
    for (let i = 0; i < maxFrames; i++) {
        runFrames(1);
        const serial = getDebugInfo().serialBuffer;
        if (serial.includes('Passed') || serial.includes('Failed')) {
            return serial;
        }
    }
    return getDebugInfo().serialBuffer;
}

export function testBlargg02Interrupts() {
    const romPath = join(__dirname, '../roms/gb-test-roms/cpu_instrs/individual/02-interrupts.gb');
    const output = runBlarggRom(romPath);
    const passed = output.includes('Passed');
    if (!passed) {
        console.log('  Serial output: ' + JSON.stringify(output));
    }
    return passed;
}
