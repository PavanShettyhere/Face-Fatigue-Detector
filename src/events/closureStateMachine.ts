import type { ClosureClassification, ClosureEvent } from "../types/domain";
import { makeId } from "../utils/id";
import { clamp } from "../utils/math";

interface ClosureStateMachineOptions {
  threshold: number;
  releaseThreshold: number;
  prolongedClosureMs: number;
  microsleepMs: number;
}

export class ClosureStateMachine {
  private readonly options: ClosureStateMachineOptions;
  private startTime: number | null = null;

  constructor(options: ClosureStateMachineOptions) {
    this.options = options;
  }

  update(input: {
    timestamp: number;
    combinedClosure: number;
    trackingConfidence: number;
  }): ClosureEvent | null {
    const { timestamp, combinedClosure, trackingConfidence } = input;
    if (trackingConfidence < 0.2) {
      return null;
    }

    if (this.startTime === null && combinedClosure >= this.options.threshold) {
      this.startTime = timestamp;
      return null;
    }

    if (this.startTime !== null && combinedClosure <= this.options.releaseThreshold) {
      const duration = timestamp - this.startTime;
      if (duration < this.options.prolongedClosureMs) {
        this.startTime = null;
        return null;
      }
      const classification: ClosureClassification =
        duration >= this.options.microsleepMs
          ? "microsleep-candidate"
          : "prolonged-closure";
      const event: ClosureEvent = {
        eventId: makeId("closure"),
        startTime: this.startTime,
        endTime: timestamp,
        duration,
        classification,
        confidence: clamp(
          trackingConfidence * 0.5 + Math.min(1, combinedClosure) * 0.5,
          0,
          1,
        ),
      };
      this.startTime = null;
      return event;
    }

    return null;
  }

  reset(): void {
    this.startTime = null;
  }
}
