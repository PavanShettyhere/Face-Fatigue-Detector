import type { YawnEvent } from "../types/domain";
import { makeId } from "../utils/id";
import { clamp } from "../utils/math";

interface YawnStateMachineOptions {
  openThreshold: number;
  closeThreshold: number;
  minDurationMs: number;
  talkingRejectDurationMs: number;
}

interface YawnCandidate {
  eventId: string;
  startTime: number;
  lastTime: number;
  maxOpening: number;
}

export class YawnStateMachine {
  private readonly options: YawnStateMachineOptions;
  private candidate: YawnCandidate | null = null;
  private state: "idle" | "opening" | "yawning" = "idle";

  constructor(options: YawnStateMachineOptions) {
    this.options = options;
  }

  update(input: {
    timestamp: number;
    mouthOpening: number;
    trackingConfidence: number;
  }): {
    state: string;
    event: YawnEvent | null;
    active: YawnEvent | null;
  } {
    const { timestamp, mouthOpening, trackingConfidence } = input;

    if (!this.candidate) {
      if (mouthOpening >= this.options.closeThreshold && trackingConfidence > 0.25) {
        this.candidate = {
          eventId: makeId("yawn"),
          startTime: timestamp,
          lastTime: timestamp,
          maxOpening: mouthOpening,
        };
        this.state = mouthOpening >= this.options.openThreshold ? "yawning" : "opening";
      }
      return { state: this.state, event: null, active: null };
    }

    this.candidate.lastTime = timestamp;
    this.candidate.maxOpening = Math.max(this.candidate.maxOpening, mouthOpening);

    if (mouthOpening >= this.options.openThreshold) {
      this.state = "yawning";
    }

    if (mouthOpening <= this.options.closeThreshold) {
      const duration = timestamp - this.candidate.startTime;
      const validYawn =
        duration >= this.options.minDurationMs &&
        this.candidate.maxOpening >= this.options.openThreshold;

      const event = validYawn
        ? {
            eventId: this.candidate.eventId,
            startTime: this.candidate.startTime,
            endTime: timestamp,
            duration,
            maxMouthOpening: this.candidate.maxOpening,
            confidence: clamp(
              trackingConfidence * 0.35 +
                Math.min(1, this.candidate.maxOpening) * 0.4 +
                Math.min(1, duration / (this.options.minDurationMs * 1.7)) * 0.25,
              0,
              1,
            ),
          }
        : null;

      this.candidate = null;
      this.state = "idle";
      return { state: this.state, event, active: null };
    }

    return {
      state: this.state,
      event: null,
      active: this.candidate
        ? {
            eventId: this.candidate.eventId,
            startTime: this.candidate.startTime,
            endTime: timestamp,
            duration: timestamp - this.candidate.startTime,
            maxMouthOpening: this.candidate.maxOpening,
            confidence: clamp(trackingConfidence * 0.5 + Math.min(1, this.candidate.maxOpening) * 0.5, 0, 1),
          }
        : null,
    };
  }

  reset(): void {
    this.candidate = null;
    this.state = "idle";
  }
}
