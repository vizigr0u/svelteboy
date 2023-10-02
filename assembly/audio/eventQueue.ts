import { Logger } from "../debug/logger";
import { InlinedArray } from "../utils/inlinedArray";
import { log } from "./apu";
import { AudioEvent } from "./audioTypes";

const EventQueueSize: i32 = 512;

@final
export class AudioEventQueue {
    private static data: InlinedArray<AudioEvent> = new InlinedArray<AudioEvent>(EventQueueSize);
    private static head: i32;
    private static tail: i32;

    static Reset(): void {
        AudioEventQueue.head = 0;
        AudioEventQueue.tail = -1;
    }

    @inline static get Size(): i32 { return AudioEventQueue.tail - AudioEventQueue.head + 1; }

    @inline static IsEmpty(): boolean { return AudioEventQueue.Size == 0; }

    @inline static Peek(): AudioEvent { return unchecked(AudioEventQueue.data[AudioEventQueue.head]); }

    @inline static Dequeue(): AudioEvent { return unchecked(AudioEventQueue.data[AudioEventQueue.head++]); }

    static Enqueue(frameSampleIndex: u32, type: u8, value: u8): boolean {
        if (AudioEventQueue.tail == EventQueueSize - 1) {
            if (Logger.verbose >= 1)
                log('AUDIO EVENT QUEUE FULL');
            assert(false, 'AUDIO EVENT QUEUE FULL');
            return false;
        }
        AudioEventQueue.tail++;
        const event: AudioEvent = AudioEventQueue.data[AudioEventQueue.tail];
        event.FrameSampleIndex = frameSampleIndex;
        event.Type = type;
        event.Value = value;
        return true;
    }
}
