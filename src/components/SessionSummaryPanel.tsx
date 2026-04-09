import type { SessionSummary } from "../types/domain";
import { MetricCard } from "./MetricCard";

interface SessionSummaryPanelProps {
  summary: SessionSummary | null;
}

export function SessionSummaryPanel({ summary }: SessionSummaryPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Session Summary</h2>
          <p>Aggregated metrics for the current or most recent session.</p>
        </div>
      </div>

      {summary ? (
        <div className="metrics-grid">
          <MetricCard label="Duration" value={`${summary.totalSessionDurationSec.toFixed(1)} s`} />
          <MetricCard label="Blinks" value={String(summary.totalBlinks)} hint={`${summary.blinkRatePerMinute.toFixed(1)} / min`} />
          <MetricCard label="Avg blink" value={`${summary.avgBlinkDurationMs.toFixed(0)} ms`} hint={`Max ${summary.maxBlinkDurationMs.toFixed(0)} ms`} />
          <MetricCard label="Reopen delay" value={`${summary.avgReopeningDelayMs.toFixed(0)} ms`} hint={`Slow blinks ${summary.slowBlinkCount}`} />
          <MetricCard label="Yawns" value={String(summary.totalYawns)} hint={`${(summary.totalYawnDurationMs / 1000).toFixed(1)} s total`} />
          <MetricCard label="Closures" value={String(summary.prolongedClosures)} hint={`Microsleep candidates ${summary.microsleepCandidates}`} />
          <MetricCard label="Pupil variability" value={summary.pupilVariability.toFixed(2)} />
          <MetricCard label="PERCLOS" value={`${(summary.avgPerclos * 100).toFixed(1)}%`} hint={`Peak ${(summary.maxPerclos * 100).toFixed(1)}%`} />
          <MetricCard label="Fatigue index" value={`${(summary.fatigueAverage * 100).toFixed(0)}%`} hint={`Peak ${(summary.fatiguePeak * 100).toFixed(0)}%`} />
          <MetricCard label="Quality" value={`${(summary.dataQualityAverage * 100).toFixed(0)}%`} hint={`Low-conf ${(summary.lowConfidenceFrameRate * 100).toFixed(0)}%`} />
          <MetricCard label="Alerts" value={String(summary.alertCount)} hint={`Head nods ${summary.headNodCount}`} />
          <MetricCard label="Avg FPS" value={summary.avgFps.toFixed(1)} hint={`${summary.totalFrames} frames`} />
        </div>
      ) : (
        <p className="summary-empty">Start a webcam or demo session to build a summary.</p>
      )}
    </section>
  );
}
