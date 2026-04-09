import type { NodEvent } from "../types/domain";
import { makeId } from "../utils/id";
import { clamp } from "../utils/math";

interface HeadNodOptions {
  minAmplitudeDeg: number;
  maxDurationMs: number;
}

interface PitchSample {
  timestamp: number;
  pitch: number;
}

export class HeadNodStateMachine {
  private readonly options: HeadNodOptions;
  private samples: PitchSample[] = [];

  constructor(options: HeadNodOptions) {
    this.options = options;
  }

  update(timestamp: number, pitch: number): NodEvent | null {
    this.samples.push({ timestamp, pitch });
    const minTime = timestamp - this.options.maxDurationMs;
    this.samples = this.samples.filter((sample) => sample.timestamp >= minTime);

    if (this.samples.length < 5) {
      return null;
    }

    const pitches = this.samples.map((sample) => sample.pitch);
    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);
    const amplitude = maxPitch - minPitch;

    if (amplitude < this.options.minAmplitudeDeg) {
      return null;
    }

    const lowest = this.samples.find((sample) => sample.pitch === minPitch);
    const highest = this.samples.find((sample) => sample.pitch === maxPitch);
    if (!lowest || !highest) {
      return null;
    }

    const duration = Math.abs(highest.timestamp - lowest.timestamp);
    if (duration > this.options.maxDurationMs) {
      return null;
    }

    const event: NodEvent = {
      eventId: makeId("nod"),
      startTime: Math.min(lowest.timestamp, highest.timestamp),
      endTime: Math.max(lowest.timestamp, highest.timestamp),
      duration,
      pitchAmplitude: amplitude,
      confidence: clamp(amplitude / (this.options.minAmplitudeDeg * 2), 0, 1),
    };

    this.samples = [];
    return event;
  }

  reset(): void {
    this.samples = [];
  }
}
