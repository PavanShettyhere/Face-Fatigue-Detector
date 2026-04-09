import type { BlinkClassification, BlinkEvent } from "../types/domain";
import { makeId } from "../utils/id";
import { clamp } from "../utils/math";

interface BlinkStateMachineOptions {
  closedThreshold: number;
  openThreshold: number;
  minDurationMs: number;
  maxDurationMs: number;
  fullBlinkDepth: number;
  reopeningStartDelta: number;
}

interface BlinkCandidate {
  eventId: string;
  startTime: number;
  peakTime: number;
  peakClosure: number;
  leftPeak: number;
  rightPeak: number;
  reopeningStartTime: number | null;
  lastTime: number;
}

export class BlinkStateMachine {
  private readonly options: BlinkStateMachineOptions;
  private candidate: BlinkCandidate | null = null;
  private state: "open" | "closing" | "closed" | "reopening" = "open";

  constructor(options: BlinkStateMachineOptions) {
    this.options = options;
  }

  update(input: {
    timestamp: number;
    leftClosure: number;
    rightClosure: number;
    combinedClosure: number;
    trackingConfidence: number;
  }): {
    state: string;
    event: BlinkEvent | null;
    active: BlinkEvent | null;
  } {
    const { timestamp, leftClosure, rightClosure, combinedClosure, trackingConfidence } = input;
    let finalizedEvent: BlinkEvent | null = null;

    if (!this.candidate) {
      if (combinedClosure >= this.options.openThreshold && trackingConfidence >= 0.25) {
        this.candidate = {
          eventId: makeId("blink"),
          startTime: timestamp,
          peakTime: timestamp,
          peakClosure: combinedClosure,
          leftPeak: leftClosure,
          rightPeak: rightClosure,
          reopeningStartTime: null,
          lastTime: timestamp,
        };
        this.state = combinedClosure >= this.options.closedThreshold ? "closed" : "closing";
      }
      return {
        state: this.state,
        event: null,
        active: null,
      };
    }

    this.candidate.lastTime = timestamp;

    if (combinedClosure > this.candidate.peakClosure) {
      this.candidate.peakClosure = combinedClosure;
      this.candidate.peakTime = timestamp;
      this.candidate.leftPeak = Math.max(this.candidate.leftPeak, leftClosure);
      this.candidate.rightPeak = Math.max(this.candidate.rightPeak, rightClosure);
      this.candidate.reopeningStartTime = null;
    }

    if (this.state === "closing" && combinedClosure >= this.options.closedThreshold) {
      this.state = "closed";
    }

    const movingTowardOpen =
      combinedClosure <=
      this.candidate.peakClosure - this.options.reopeningStartDelta;

    if (
      (this.state === "closing" || this.state === "closed") &&
      movingTowardOpen
    ) {
      this.state = "reopening";
      this.candidate.reopeningStartTime = timestamp;
    }

    if (this.state === "reopening" && combinedClosure <= this.options.openThreshold) {
      finalizedEvent = this.finalizeCandidate(timestamp, trackingConfidence);
    } else if (timestamp - this.candidate.startTime > this.options.maxDurationMs * 1.6) {
      finalizedEvent = this.finalizeCandidate(timestamp, trackingConfidence, "noise");
    }

    return {
      state: this.state,
      event: finalizedEvent,
      active: this.candidate ? this.toEvent(this.candidate, timestamp, trackingConfidence) : null,
    };
  }

  reset(): void {
    this.candidate = null;
    this.state = "open";
  }

  private classify(
    duration: number,
    closureDepth: number,
    forced?: BlinkClassification,
  ): BlinkClassification {
    if (forced) {
      return forced;
    }
    if (duration < this.options.minDurationMs || duration > this.options.maxDurationMs) {
      return "noise";
    }
    if (duration > this.options.maxDurationMs * 0.85) {
      return "prolonged";
    }
    return closureDepth >= this.options.fullBlinkDepth ? "full" : "partial";
  }

  private toEvent(
    candidate: BlinkCandidate,
    endTime: number,
    trackingConfidence: number,
    forcedClassification?: BlinkClassification,
  ): BlinkEvent {
    const reopeningStartTime = candidate.reopeningStartTime ?? endTime;
    const duration = endTime - candidate.startTime;
    const closingDuration = Math.max(1, candidate.peakTime - candidate.startTime);
    const reopeningDuration = Math.max(1, endTime - reopeningStartTime);
    const closureDepth = candidate.peakClosure;
    const classification = this.classify(
      duration,
      closureDepth,
      forcedClassification,
    );
    const confidence = clamp(
      trackingConfidence * 0.4 +
        closureDepth * 0.4 +
        (classification === "noise" ? 0.05 : 0.2),
      0,
      1,
    );

    return {
      eventId: candidate.eventId,
      startTime: candidate.startTime,
      peakTime: candidate.peakTime,
      endTime,
      duration,
      closingDuration,
      reopeningDuration,
      reopeningDelay: Math.max(0, reopeningStartTime - candidate.peakTime),
      blinkSpeedClose: closureDepth / closingDuration,
      blinkSpeedOpen: closureDepth / reopeningDuration,
      closureDepth,
      confidence,
      classification,
      leftClosurePeak: candidate.leftPeak,
      rightClosurePeak: candidate.rightPeak,
      asymmetry: Math.abs(candidate.leftPeak - candidate.rightPeak),
    };
  }

  private finalizeCandidate(
    endTime: number,
    trackingConfidence: number,
    forcedClassification?: BlinkClassification,
  ): BlinkEvent {
    const event = this.toEvent(
      this.candidate!,
      endTime,
      trackingConfidence,
      forcedClassification,
    );
    this.candidate = null;
    this.state = "open";
    return event;
  }
}
