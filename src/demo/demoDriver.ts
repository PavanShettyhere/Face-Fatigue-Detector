import type {
  AlertRecord,
  BlinkEvent,
  ClosureEvent,
  LiveAnalysisState,
  NodEvent,
  YawnEvent,
} from "../types/domain";
import { makeId } from "../utils/id";

function alert(timestamp: number, title: string, level: AlertRecord["level"], message: string): AlertRecord {
  return {
    id: makeId("alert"),
    timestamp,
    title,
    level,
    message,
  };
}

export function buildDemoState(timestamp: number, frameIndex: number): Partial<LiveAnalysisState> {
  const t = timestamp / 1000;
  const blinkEnvelope = Math.max(0, Math.sin(t * 0.9) ** 12);
  const yawnEnvelope = Math.max(0, Math.sin(t * 0.18 - 0.8) ** 8);
  const fatigue = Math.min(1, 0.25 + (Math.sin(t * 0.06) + 1) * 0.14 + yawnEnvelope * 0.25);

  return {
    mode: "demo",
    statusText: "Synthetic mode active",
    mouthOpening: 0.18 + yawnEnvelope * 0.54,
    blinkState: blinkEnvelope > 0.7 ? "reopening" : "open",
    yawnState: yawnEnvelope > 0.45 ? "yawning" : "idle",
    blinkCount: Math.floor(t / 4.2),
    yawnCount: Math.floor(t / 18),
    prolongedClosureCount: Math.floor(t / 52),
    fatigueIndex: fatigue,
    lightingScore: 0.78,
    gazeInstability: 0.18 + Math.abs(Math.sin(t * 0.3)) * 0.12,
    frameIndex,
    fps: 30,
    confidenceScore: 0.84,
    perclos: {
      left: 0.08 + blinkEnvelope * 0.12,
      right: 0.07 + blinkEnvelope * 0.11,
      combined: 0.09 + blinkEnvelope * 0.15,
    },
    alerts:
      fatigue > 0.62
        ? [
            alert(
              timestamp,
              "Demo fatigue alert",
              "warning",
              "Synthetic fatigue index crossed the warning threshold.",
            ),
          ]
        : [],
  };
}

export function buildDemoBlink(timestamp: number): BlinkEvent {
  return {
    eventId: makeId("blink"),
    startTime: timestamp - 160,
    peakTime: timestamp - 90,
    endTime: timestamp,
    duration: 160,
    closingDuration: 70,
    reopeningDuration: 70,
    reopeningDelay: 20,
    blinkSpeedClose: 0.012,
    blinkSpeedOpen: 0.011,
    closureDepth: 0.93,
    confidence: 0.9,
    classification: "full",
    leftClosurePeak: 0.91,
    rightClosurePeak: 0.95,
    asymmetry: 0.04,
  };
}

export function buildDemoYawn(timestamp: number): YawnEvent {
  return {
    eventId: makeId("yawn"),
    startTime: timestamp - 1700,
    endTime: timestamp,
    duration: 1700,
    maxMouthOpening: 0.81,
    confidence: 0.88,
  };
}

export function buildDemoClosure(timestamp: number): ClosureEvent {
  return {
    eventId: makeId("closure"),
    startTime: timestamp - 1450,
    endTime: timestamp,
    duration: 1450,
    classification: "prolonged-closure",
    confidence: 0.83,
  };
}

export function buildDemoNod(timestamp: number): NodEvent {
  return {
    eventId: makeId("nod"),
    startTime: timestamp - 420,
    endTime: timestamp,
    duration: 420,
    pitchAmplitude: 16,
    confidence: 0.76,
  };
}
