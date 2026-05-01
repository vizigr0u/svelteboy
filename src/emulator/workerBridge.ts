// Thin re-export of the emulator worker proxy created by wasmBridge.
// (wasmBridge owns spawn + bootstrap so module-init ordering is deterministic
// — see the header comment there for why.)

import { emulatorProxy } from './wasmBridge';

export function getEmulatorProxy(): Promise<typeof emulatorProxy> {
    return Promise.resolve(emulatorProxy);
}
