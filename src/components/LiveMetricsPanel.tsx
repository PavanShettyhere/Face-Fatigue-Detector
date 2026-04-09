import type { LiveAnalysisState } from "../types/domain";
import { MetricCard } from "./MetricCard";

function formatMaybe(value: number | null, digits = 2, suffix = ""): string {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(digits)}${suffix}`;
}

interface LiveMetricsPanelProps {
  state: LiveAnalysisState;
}

export function LiveMetricsPanel({ state }: LiveMetricsPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Live Metrics</h2>
          <p>Smoothed eye, face, and fatigue estimates.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Left pupil" value={formatMaybe(state.leftEye.pupilDiameterPx, 2, " px")} hint={`conf ${Math.round(state.leftEye.pupilConfidence * 100)}%`} />
        <MetricCard label="Right pupil" value={formatMaybe(state.rightEye.pupilDiameterPx, 2, " px")} hint={`conf ${Math.round(state.rightEye.pupilConfidence * 100)}%`} />
        <MetricCard label="Blink count" value={String(state.blinkCount)} hint={`${state.blinkRatePerMinute.toFixed(1)} / min`} />
        <MetricCard label="Last blink" value={state.lastBlink ? `${state.lastBlink.duration.toFixed(0)} ms` : "n/a"} hint={state.lastBlink ? `reopen ${state.lastBlink.reopeningDelay.toFixed(0)} ms` : "No completed blink"} />
        <MetricCard label="PERCLOS" value={`${(state.perclos.combined * 100).toFixed(1)}%`} tone={state.perclos.combined > 0.3 ? "critical" : state.perclos.combined > 0.2 ? "warning" : "default"} hint={`L ${(state.perclos.left * 100).toFixed(0)}% / R ${(state.perclos.right * 100).toFixed(0)}%`} />
        <MetricCard label="Mouth opening" value={state.mouthOpening.toFixed(2)} hint={`Yawns ${state.yawnCount}`} />
        <MetricCard label="Fatigue index" value={`${(state.fatigueIndex * 100).toFixed(0)}%`} tone={state.fatigueIndex > 0.7 ? "critical" : state.fatigueIndex > 0.55 ? "warning" : "default"} hint="Experimental, non-diagnostic" />
        <MetricCard label="Head pose" value={`${state.face.headPose.pitch.toFixed(1)} / ${state.face.headPose.yaw.toFixed(1)} / ${state.face.headPose.roll.toFixed(1)}`} hint="pitch / yaw / roll" />
        <MetricCard label="Lighting" value={`${(state.lightingScore * 100).toFixed(0)}%`} hint={`confidence ${(state.confidenceScore * 100).toFixed(0)}%`} />
        <MetricCard label="FPS" value={state.fps.toFixed(1)} hint={`Frame ${state.frameIndex}`} tone={state.fps < 15 ? "warning" : "positive"} />
        <MetricCard label="Gaze instability" value={`${(state.gazeInstability * 100).toFixed(0)}%`} hint={`closure events ${state.prolongedClosureCount}`} />
        <MetricCard label="Blink state" value={state.blinkState} hint={`Yawn ${state.yawnState}`} />
      </div>
    </section>
  );
}
