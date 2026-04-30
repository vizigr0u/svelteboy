import { memory, getGameFramePtr, getCGBGameFramePtr } from "../../build/backend";

export * from "../../build/backend";
export { memory as backendMemory } from "../../build/backend";

export function getGameFrameView(): Uint8Array {
    return new Uint8Array(memory.buffer as ArrayBuffer, getGameFramePtr(), 160 * 144);
}

export function getCgbGameFrameView(): Uint16Array {
    return new Uint16Array(memory.buffer as ArrayBuffer, getCGBGameFramePtr(), 160 * 144);
}

export function getAudioBufferView(ptr: number, sampleCount: number): Float32Array<ArrayBuffer> {
    return new Float32Array(memory.buffer as ArrayBuffer, ptr, sampleCount);
}
