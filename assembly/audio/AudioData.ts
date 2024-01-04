import { Uint4Array } from "./Uint4Array";
import { AudioOutBuffer } from "./audioBuffer";
import { SoundDataSize } from "./audioRegisters";
import { AudioRegisterType, getRegisterIndex } from "./audioTypes";

const HalfBufferSize: i32 = AudioOutBuffer.BufferSize >> 1;

@final
export class AudioData {
    private static channelSound: Uint4Array = new Uint4Array(AudioOutBuffer.BufferSize * 4);

    static registers: Uint8Array = new Uint8Array(SoundDataSize);
    static channel1Buffer: Uint4Array = Uint4Array.wrap(AudioData.channelSound.buffer, 0 * HalfBufferSize, HalfBufferSize);
    static channel2Buffer: Uint4Array = Uint4Array.wrap(AudioData.channelSound.buffer, 1 * HalfBufferSize, HalfBufferSize);
    static channel3Buffer: Uint4Array = Uint4Array.wrap(AudioData.channelSound.buffer, 2 * HalfBufferSize, HalfBufferSize);
    static channel4Wave: Uint4Array = Uint4Array.wrap(AudioData.registers.buffer, getRegisterIndex(AudioRegisterType.WaveStart), AudioRegisterType.Offset);
    static channel4Buffer: Uint4Array = Uint4Array.wrap(AudioData.channelSound.buffer, 3 * HalfBufferSize, HalfBufferSize);

}