export * from "./index";

export { testRegisters } from "./tests/registerTests";
export { testMemory } from "./tests/memoryTests";
export {
  testCpu,
  testNop,
  resetCpuTestSession,
  getCpuTestSessionSummary
} from './tests/cpuTests';
export { testPrograms } from './tests/programTests';
export { testInstructions } from './tests/instructions';
export { testVideo } from './tests/video';
export { testMisc } from './tests/miscTests';
export { testInterrupts } from './tests/interruptTests';
export { testHalt } from './tests/haltTests';
export { testFifo } from './tests/fifoTests';
export { testPixelFifo } from './tests/pixelFifoTests';
export { testUint4Array } from './tests/Uint4ArrayTests';
export { testAudioRegisters } from './tests/audioRegisterTests';
export { testPulseChannel } from './tests/pulseChannelTests';
export { testWaveChannel } from './tests/waveChannelTests';
export { testNoiseChannel } from './tests/noiseChannelTests';
export { testAudioRender } from './tests/audioRenderTests';
export { testMbc } from './tests/mbcTests';
export { testSerial } from './tests/serialTests';
export { testMetadata } from './tests/metadataTests';
export { testEmulator } from './tests/emulatorTests';
export { testTimer } from './tests/timerTests';
export { testCgbState } from './tests/cgbStateTests';
export { testWramBank } from './tests/wramBankTests';
export { testJoypad } from './tests/joypadTests';
export { testPowerUp } from './tests/powerUpTests';
export { testSaveState } from './tests/saveStateTests';
export { testCgbSaveState } from './tests/cgbSaveStateTests';
export { testHdma } from './tests/hdmaTests';
export { testCgbIoRegs } from './tests/cgbIoRegsTests';
export { testCgbSpeedSwitch } from './tests/cgbSpeedSwitchTests';

import { ScanlineRenderer } from "./io/video/scanlineRenderer";
export function instrumentedDiag(): void {
    ScanlineRenderer.RenderDiag();
}
