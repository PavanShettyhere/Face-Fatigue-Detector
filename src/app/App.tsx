import { useState } from "react";

import { ControlsPanel } from "../components/ControlsPanel";
import { EventTimeline } from "../components/EventTimeline";
import { LineChart } from "../components/LineChart";
import { LiveMetricsPanel } from "../components/LiveMetricsPanel";
import { LiveVideoPanel } from "../components/LiveVideoPanel";
import { SessionSummaryPanel } from "../components/SessionSummaryPanel";
import { useAnalysisSession } from "../hooks/useAnalysisSession";

function resolutionFromConfig(width: number, height: number): string {
  return `${width}x${height}`;
}

export default function App() {
  const {
    config,
    updateConfig,
    liveState,
    chartState,
    devices,
    canvasRef,
    videoRef,
    profiles,
    activeProfileId,
    setActiveProfileId,
    recording,
    calibration,
    sessionSummary,
    blinkEvents,
    yawnEvents,
    closureEvents,
    nodEvents,
    startCamera,
    startDemo,
    stopSession,
    toggleRecording,
    takeSnapshot,
    exportFrameMetrics,
    exportEventMetrics,
    exportSummary,
    startCalibration,
    saveProfile,
    clearSessionData,
  } = useAnalysisSession();

  const [profileName, setProfileName] = useState("Participant A");

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Face Fatigue Detector</p>
          <h1>Real-time eye, blink, yawn, and fatigue-oriented webcam analytics</h1>
          <p className="hero__lede">
            A privacy-first prototype for live face tracking, pupil diameter
            estimation, blink dynamics, PERCLOS, yawning, head pose, and
            transparent fatigue indicators. Every output is an estimate from
            video analysis, not a medical diagnosis.
          </p>
        </div>
        <div className="hero__facts">
          <div>
            <strong>Inference</strong>
            <span>Local in browser</span>
          </div>
          <div>
            <strong>Tracking target</strong>
            <span>15 to 30 FPS</span>
          </div>
          <div>
            <strong>Output</strong>
            <span>CSV, JSON, snapshots, recording</span>
          </div>
        </div>
      </header>

      <section className="dashboard-grid">
        <div className="dashboard-grid__wide">
          <LiveVideoPanel
            canvasRef={canvasRef}
            videoRef={videoRef}
            state={liveState}
            calibrationActive={calibration.active}
          />
        </div>
        <div className="dashboard-grid__narrow">
          <LiveMetricsPanel state={liveState} />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-grid__narrow">
          <ControlsPanel
            devices={devices}
            profiles={profiles}
            activeProfileId={activeProfileId}
            setActiveProfileId={setActiveProfileId}
            calibrationActive={calibration.active}
            profileName={profileName}
            setProfileName={setProfileName}
            cameraDeviceId={config.camera.deviceId}
            setCameraDeviceId={(value) =>
              updateConfig((current) => ({
                ...current,
                camera: {
                  ...current.camera,
                  deviceId: value || undefined,
                },
              }))
            }
            resolution={resolutionFromConfig(
              config.camera.width,
              config.camera.height,
            )}
            setResolution={(value) => {
              const [width, height] = value.split("x").map(Number);
              updateConfig((current) => ({
                ...current,
                camera: {
                  ...current.camera,
                  width,
                  height,
                },
              }));
            }}
            frameRateCap={config.camera.frameRateCap}
            setFrameRateCap={(value) =>
              updateConfig((current) => ({
                ...current,
                camera: {
                  ...current.camera,
                  frameRateCap: value,
                },
              }))
            }
            brightness={config.camera.brightnessCompensation}
            setBrightness={(value) =>
              updateConfig((current) => ({
                ...current,
                camera: {
                  ...current.camera,
                  brightnessCompensation: value,
                },
              }))
            }
            contrast={config.camera.contrastCompensation}
            setContrast={(value) =>
              updateConfig((current) => ({
                ...current,
                camera: {
                  ...current.camera,
                  contrastCompensation: value,
                },
              }))
            }
            perclosWindowMs={config.detector.perclosWindowMs}
            setPerclosWindowMs={(value) =>
              updateConfig((current) => ({
                ...current,
                detector: {
                  ...current.detector,
                  perclosWindowMs: value,
                },
              }))
            }
            soundAlerts={config.ui.soundAlerts}
            setSoundAlerts={(value) =>
              updateConfig((current) => ({
                ...current,
                ui: {
                  ...current.ui,
                  soundAlerts: value,
                },
              }))
            }
            startCamera={startCamera}
            startDemo={startDemo}
            stopSession={stopSession}
            toggleRecording={toggleRecording}
            recording={recording}
            takeSnapshot={takeSnapshot}
            startCalibration={startCalibration}
            saveProfile={saveProfile}
            exportFrameMetrics={exportFrameMetrics}
            exportEventMetrics={exportEventMetrics}
            exportSummary={exportSummary}
            clearSessionData={clearSessionData}
          />
        </div>

        <div className="dashboard-grid__wide">
          <section className="charts-grid">
            <LineChart
              title="Eye Openness"
              subtitle="Combined openness ratio over time"
              points={chartState.openness}
              color="#70e1f5"
              min={0}
              max={0.4}
            />
            <LineChart
              title="Pupil Diameter"
              subtitle="Average diameter in pixels"
              points={chartState.pupil}
              color="#ffbf69"
              min={0}
              max={16}
            />
            <LineChart
              title="PERCLOS"
              subtitle="Rolling combined eye-closure percentage"
              points={chartState.perclos}
              color="#ff5d73"
              min={0}
              max={1}
            />
            <LineChart
              title="Mouth Opening"
              subtitle="Sustained mouth-opening estimate for yawn detection"
              points={chartState.mouth}
              color="#ff8fab"
              min={0}
              max={1}
            />
            <LineChart
              title="Fatigue Index"
              subtitle="Transparent composite of visual indicators"
              points={chartState.fatigue}
              color="#7ae582"
              min={0}
              max={1}
            />
          </section>

          <div className="dashboard-grid dashboard-grid--stacked">
            <EventTimeline
              blinks={blinkEvents}
              yawns={yawnEvents}
              closures={closureEvents}
              nods={nodEvents}
            />
            <SessionSummaryPanel summary={sessionSummary} />
          </div>
        </div>
      </section>

      <section className="panel notes-panel">
        <div className="panel__header">
          <div>
            <h2>Interpretation Notes</h2>
            <p>What is strong, what is approximate, and what needs calibration.</p>
          </div>
        </div>
        <div className="notes-grid">
          <article>
            <h3>Works reliably</h3>
            <p>
              Face tracking, eyelid openness, blink timing, PERCLOS, mouth-opening
              dynamics, and coarse head pose are the strongest signals in normal
              lighting with a mostly frontal face.
            </p>
          </article>
          <article>
            <h3>Approximate</h3>
            <p>
              Pupil diameter, gaze stability, fatigue scoring, and nod detection
              are heuristic estimates. They are suitable for prototyping and
              research demos, not clinical interpretation.
            </p>
          </article>
          <article>
            <h3>Needs calibration</h3>
            <p>
              Personalized eye openness, mouth baseline, and pupil size improve
              blink classification, yawn separation, and fatigue thresholds. Use
              the built-in 5-second neutral calibration before recording.
            </p>
          </article>
          <article>
            <h3>Degrades under</h3>
            <p>
              Low light, glasses glare, motion blur, partial occlusion, and strong
              head rotation lower confidence and can suppress pupil-based metrics
              to avoid hallucinated values.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
