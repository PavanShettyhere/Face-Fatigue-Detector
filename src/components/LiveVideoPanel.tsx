import type { MutableRefObject } from "react";

import type { LiveAnalysisState } from "../types/domain";
import { AlertStack } from "./AlertStack";

interface LiveVideoPanelProps {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  state: LiveAnalysisState;
  calibrationActive: boolean;
}

export function LiveVideoPanel({
  canvasRef,
  videoRef,
  state,
  calibrationActive,
}: LiveVideoPanelProps) {
  return (
    <section className="panel video-panel">
      <div className="panel__header">
        <div>
          <h2>Live Analysis</h2>
          <p>All visual estimates are local and non-medical.</p>
        </div>
        <div className="status-badges">
          <span className={`status-badge status-badge--${state.mode}`}>
            {state.mode === "camera" ? "Webcam" : state.mode === "demo" ? "Demo" : "Idle"}
          </span>
          <span className="status-badge status-badge--neutral">{state.statusText}</span>
          {calibrationActive ? (
            <span className="status-badge status-badge--warning">Calibration</span>
          ) : null}
        </div>
      </div>

      <div className="video-surface">
        <canvas ref={canvasRef} className="video-surface__canvas" />
        <video ref={videoRef} className="video-surface__hidden-video" playsInline muted />
        <AlertStack alerts={state.alerts} />
      </div>
    </section>
  );
}
