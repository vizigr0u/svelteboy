import { Logger } from "../debug/logger";
import { InlinedArray } from "../utils/inlinedArray";
import { log } from "./apu";
import { AudioEvent } from "./audioTypes";

const EventQueueSize: i32 = 512;

@final
export class AudioEventQueue {
    static data: InlinedArray<AudioEvent> = new InlinedArray<AudioEvent>(EventQueueSize);
    static head: i32;
    static tail: i32;

    static Reset(): void {
        AudioEventQueue.head = 0;
        AudioEventQueue.tail = -1;
    }

    @inline
    static get Size(): i32 { return AudioEventQueue.tail - AudioEventQueue.head + 1; }

    static Enqueue(timeOffset: u32, type: u8, value: u8): boolean {
        if (AudioEventQueue.tail == EventQueueSize - 1) {
            if (Logger.verbose >= 1)
                log('AUDIO EVENT QUEUE FULL');
            assert(false, 'AUDIO EVENT QUEUE FULL');
            return false;
        }
        AudioEventQueue.tail++;
        const event: AudioEvent = AudioEventQueue.data[AudioEventQueue.tail];
        event.TimeOffset = timeOffset;
        event.Type = type;
        event.Value = value;
        return true;
    }
}
