import { CYCLES_PER_SECOND } from "../constants";

export const SAMPLE_RATE: f64 = 44100;
export const CYCLES_PER_SAMPLE: f64 = CYCLES_PER_SECOND / SAMPLE_RATE;
export const SAMPLES_PER_MS: f64 = SAMPLE_RATE / 1000;
export const SAMPLE_DURATION: f64 = 1 / SAMPLE_RATE;
