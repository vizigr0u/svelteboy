// SvelteBoy AudioWorklet processor.
// Reads stereo f32 frames from a SAB ring buffer (see src/audio/sabRingBuffer.ts).
// Layout: [READ_IDX:i32, WRITE_IDX:i32, left[capacity]:f32, right[capacity]:f32]

const READ_IDX = 0;
const WRITE_IDX = 1;
const HEADER_BYTES = 8;
const REPORT_INTERVAL_BLOCKS = 200;

class SvelteBoyAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.header = null;
        this.left = null;
        this.right = null;
        this.capacity = 0;
        this.mask = 0;
        this.underruns = 0;
        this.totalUnderrunFrames = 0;
        this.blocksSinceReport = 0;

        this.port.onmessage = (e) => {
            const data = e.data;
            if (!data) return;
            if (data.type === 'init') {
                const { sab, capacity } = data;
                this.header = new Int32Array(sab, 0, 2);
                this.left = new Float32Array(sab, HEADER_BYTES, capacity);
                this.right = new Float32Array(sab, HEADER_BYTES + capacity * 4, capacity);
                this.capacity = capacity;
                this.mask = capacity - 1;
            } else if (data.type === 'reset') {
                if (this.header) {
                    Atomics.store(this.header, READ_IDX, 0);
                    Atomics.store(this.header, WRITE_IDX, 0);
                }
            }
        };
    }

    process(_inputs, outputs) {
        const out = outputs[0];
        if (!out || out.length === 0) return true;
        const outL = out[0];
        const outR = out.length > 1 ? out[1] : out[0];
        const n = outL.length;

        if (!this.header) {
            outL.fill(0);
            if (outR !== outL) outR.fill(0);
            return true;
        }

        const w = Atomics.load(this.header, WRITE_IDX);
        const r = Atomics.load(this.header, READ_IDX);
        const avail = (w - r) | 0;
        const toRead = avail < n ? avail : n;

        if (toRead > 0) {
            const start = r & this.mask;
            const tailRoom = this.capacity - start;
            const first = toRead < tailRoom ? toRead : tailRoom;
            outL.set(this.left.subarray(start, start + first), 0);
            if (outR !== outL) outR.set(this.right.subarray(start, start + first), 0);
            if (first < toRead) {
                outL.set(this.left.subarray(0, toRead - first), first);
                if (outR !== outL) outR.set(this.right.subarray(0, toRead - first), first);
            }
            Atomics.store(this.header, READ_IDX, (r + toRead) | 0);
        }

        if (toRead < n) {
            outL.fill(0, toRead);
            if (outR !== outL) outR.fill(0, toRead);
            this.underruns++;
            this.totalUnderrunFrames += (n - toRead);
        }

        if (++this.blocksSinceReport >= REPORT_INTERVAL_BLOCKS) {
            if (this.underruns > 0) {
                this.port.postMessage({
                    type: 'stats',
                    underruns: this.underruns,
                    underrunFrames: this.totalUnderrunFrames,
                });
                this.underruns = 0;
                this.totalUnderrunFrames = 0;
            }
            this.blocksSinceReport = 0;
        }

        return true;
    }
}

registerProcessor('svelteboy-audio-processor', SvelteBoyAudioProcessor);
