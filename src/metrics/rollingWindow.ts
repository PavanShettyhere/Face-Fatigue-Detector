import { clamp } from "../utils/math";

export class RollingTimeSeries {
  private readonly windowMs: number;
  private readonly samples: Array<{ timestamp: number; value: number | null }> = [];

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  push(timestamp: number, value: number | null): void {
    this.samples.push({ timestamp, value });
    this.prune(timestamp);
  }

  values(): Array<{ timestamp: number; value: number | null }> {
    return [...this.samples];
  }

  prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.samples.length && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }
  }
}

export class PerclosTracker {
  private readonly windowMs: number;
  private readonly samples: Array<{
    timestamp: number;
    leftClosed: boolean;
    rightClosed: boolean;
    combinedClosed: boolean;
  }> = [];

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  push(sample: {
    timestamp: number;
    leftClosed: boolean;
    rightClosed: boolean;
    combinedClosed: boolean;
  }): { left: number; right: number; combined: number } {
    this.samples.push(sample);
    this.prune(sample.timestamp);

    if (this.samples.length < 2) {
      return { left: 0, right: 0, combined: 0 };
    }

    let leftClosedMs = 0;
    let rightClosedMs = 0;
    let combinedClosedMs = 0;
    let totalMs = 0;

    for (let index = 1; index < this.samples.length; index += 1) {
      const previous = this.samples[index - 1];
      const current = this.samples[index];
      const dt = current.timestamp - previous.timestamp;
      totalMs += dt;
      if (previous.leftClosed) {
        leftClosedMs += dt;
      }
      if (previous.rightClosed) {
        rightClosedMs += dt;
      }
      if (previous.combinedClosed) {
        combinedClosedMs += dt;
      }
    }

    return {
      left: clamp(leftClosedMs / Math.max(1, totalMs), 0, 1),
      right: clamp(rightClosedMs / Math.max(1, totalMs), 0, 1),
      combined: clamp(combinedClosedMs / Math.max(1, totalMs), 0, 1),
    };
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.samples.length && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }
  }
}
