import type {
  AlertRecord,
  BlinkEvent,
  ClosureEvent,
  FrameMetric,
  NodEvent,
  SessionSummary,
  YawnEvent,
} from "../types/domain";
import { average, stdDev } from "../utils/math";

export class SessionStore {
  readonly startedAt = new Date().toISOString();
  frames: FrameMetric[] = [];
  blinkEvents: BlinkEvent[] = [];
  yawnEvents: YawnEvent[] = [];
  closureEvents: ClosureEvent[] = [];
  nodEvents: NodEvent[] = [];
  alerts: AlertRecord[] = [];

  recordFrame(frame: FrameMetric): void {
    this.frames.push(frame);
  }

  recordBlink(event: BlinkEvent): void {
    this.blinkEvents.push(event);
  }

  recordYawn(event: YawnEvent): void {
    this.yawnEvents.push(event);
  }

  recordClosure(event: ClosureEvent): void {
    this.closureEvents.push(event);
  }

  recordNod(event: NodEvent): void {
    this.nodEvents.push(event);
  }

  recordAlert(alert: AlertRecord): void {
    this.alerts.push(alert);
  }

  clear(): void {
    this.frames = [];
    this.blinkEvents = [];
    this.yawnEvents = [];
    this.closureEvents = [];
    this.nodEvents = [];
    this.alerts = [];
  }

  buildSummary(): SessionSummary {
    const endedAt = new Date().toISOString();
    const firstFrame = this.frames[0];
    const lastFrame = this.frames[this.frames.length - 1];
    const durationSec = firstFrame && lastFrame ? (lastFrame.timestamp - firstFrame.timestamp) / 1000 : 0;
    const avgBlinkDuration =
      average(this.blinkEvents.map((event) => event.duration)) ?? 0;
    const avgReopeningDelay =
      average(this.blinkEvents.map((event) => event.reopeningDelay)) ?? 0;
    const avgBlinkAsymmetry =
      average(this.blinkEvents.map((event) => event.asymmetry)) ?? 0;
    const avgPerclos = average(this.frames.map((frame) => frame.perclosCombined)) ?? 0;
    const pupilValues = this.frames
      .map((frame) => frame.averagePupilDiameter)
      .filter((value): value is number => value !== null);

    return {
      startedAt: this.startedAt,
      endedAt,
      totalSessionDurationSec: durationSec,
      totalFrames: this.frames.length,
      avgFps: average(this.frames.map((frame) => frame.fps)) ?? 0,
      totalBlinks: this.blinkEvents.length,
      blinkRatePerMinute: durationSec > 0 ? this.blinkEvents.length / (durationSec / 60) : 0,
      avgBlinkDurationMs: avgBlinkDuration,
      maxBlinkDurationMs: Math.max(0, ...this.blinkEvents.map((event) => event.duration)),
      avgReopeningDelayMs: avgReopeningDelay,
      avgBlinkAsymmetry,
      slowBlinkCount: this.blinkEvents.filter((event) => event.reopeningDelay > 120).length,
      prolongedClosures: this.closureEvents.filter((event) => event.classification === "prolonged-closure").length,
      microsleepCandidates: this.closureEvents.filter((event) => event.classification === "microsleep-candidate").length,
      avgLeftPupilDiameter: average(this.frames.map((frame) => frame.leftPupilDiameter)) ?? null,
      avgRightPupilDiameter: average(this.frames.map((frame) => frame.rightPupilDiameter)) ?? null,
      pupilVariability: stdDev(pupilValues),
      totalYawns: this.yawnEvents.length,
      totalYawnDurationMs: this.yawnEvents.reduce((sum, event) => sum + event.duration, 0),
      maxPerclos: Math.max(0, ...this.frames.map((frame) => frame.perclosCombined)),
      avgPerclos,
      fatigueAverage: average(this.frames.map((frame) => frame.fatigueIndex)) ?? 0,
      fatiguePeak: Math.max(0, ...this.frames.map((frame) => frame.fatigueIndex)),
      headNodCount: this.nodEvents.length,
      dataQualityAverage: average(this.frames.map((frame) => frame.trackingQuality)) ?? 0,
      lowConfidenceFrameRate:
        this.frames.length > 0
          ? this.frames.filter((frame) => frame.trackingConfidence < 0.45).length / this.frames.length
          : 0,
      alertCount: this.alerts.length,
    };
  }
}
