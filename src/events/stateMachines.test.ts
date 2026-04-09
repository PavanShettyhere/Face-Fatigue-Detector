import { describe, expect, it } from "vitest";

import { BlinkStateMachine } from "./blinkStateMachine";
import { YawnStateMachine } from "./yawnStateMachine";

describe("BlinkStateMachine", () => {
  it("emits a full blink after closing and reopening", () => {
    const machine = new BlinkStateMachine({
      closedThreshold: 0.72,
      openThreshold: 0.38,
      minDurationMs: 60,
      maxDurationMs: 900,
      fullBlinkDepth: 0.85,
      reopeningStartDelta: 0.04,
    });

    const samples = [
      { timestamp: 0, value: 0.12 },
      { timestamp: 30, value: 0.52 },
      { timestamp: 60, value: 0.84 },
      { timestamp: 110, value: 0.92 },
      { timestamp: 160, value: 0.58 },
      { timestamp: 210, value: 0.2 },
    ];

    let event = null;
    for (const sample of samples) {
      const result = machine.update({
        timestamp: sample.timestamp,
        leftClosure: sample.value,
        rightClosure: sample.value,
        combinedClosure: sample.value,
        trackingConfidence: 0.9,
      });
      event = result.event ?? event;
    }

    expect(event).not.toBeNull();
    expect(event?.classification).toBe("full");
    expect(event?.duration).toBeGreaterThanOrEqual(150);
  });
});

describe("YawnStateMachine", () => {
  it("emits a yawn only when mouth opening persists long enough", () => {
    const machine = new YawnStateMachine({
      openThreshold: 0.55,
      closeThreshold: 0.32,
      minDurationMs: 750,
      talkingRejectDurationMs: 280,
    });

    const samples = [
      { timestamp: 0, value: 0.2 },
      { timestamp: 100, value: 0.44 },
      { timestamp: 300, value: 0.64 },
      { timestamp: 700, value: 0.72 },
      { timestamp: 1000, value: 0.68 },
      { timestamp: 1400, value: 0.24 },
    ];

    let event = null;
    for (const sample of samples) {
      const result = machine.update({
        timestamp: sample.timestamp,
        mouthOpening: sample.value,
        trackingConfidence: 0.85,
      });
      event = result.event ?? event;
    }

    expect(event).not.toBeNull();
    expect(event?.duration).toBeGreaterThanOrEqual(1000);
  });
});
