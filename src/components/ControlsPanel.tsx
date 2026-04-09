import type { CalibrationProfile } from "../types/domain";

interface ControlsPanelProps {
  devices: MediaDeviceInfo[];
  profiles: CalibrationProfile[];
  activeProfileId: string | null;
  setActiveProfileId: (profileId: string | null) => void;
  calibrationActive: boolean;
  profileName: string;
  setProfileName: (value: string) => void;
  cameraDeviceId?: string;
  setCameraDeviceId: (value: string) => void;
  resolution: string;
  setResolution: (value: string) => void;
  frameRateCap: number;
  setFrameRateCap: (value: number) => void;
  brightness: number;
  setBrightness: (value: number) => void;
  contrast: number;
  setContrast: (value: number) => void;
  perclosWindowMs: number;
  setPerclosWindowMs: (value: number) => void;
  soundAlerts: boolean;
  setSoundAlerts: (value: boolean) => void;
  startCamera: () => void;
  startDemo: () => void;
  stopSession: () => void;
  toggleRecording: () => void;
  recording: boolean;
  takeSnapshot: () => void;
  startCalibration: (name: string) => void;
  saveProfile: (name: string) => void;
  exportFrameMetrics: () => void;
  exportEventMetrics: () => void;
  exportSummary: () => void;
  clearSessionData: () => void;
}

export function ControlsPanel(props: ControlsPanelProps) {
  const {
    devices,
    profiles,
    activeProfileId,
    setActiveProfileId,
    calibrationActive,
    profileName,
    setProfileName,
    cameraDeviceId,
    setCameraDeviceId,
    resolution,
    setResolution,
    frameRateCap,
    setFrameRateCap,
    brightness,
    setBrightness,
    contrast,
    setContrast,
    perclosWindowMs,
    setPerclosWindowMs,
    soundAlerts,
    setSoundAlerts,
    startCamera,
    startDemo,
    stopSession,
    toggleRecording,
    recording,
    takeSnapshot,
    startCalibration,
    saveProfile,
    exportFrameMetrics,
    exportEventMetrics,
    exportSummary,
    clearSessionData,
  } = props;

  return (
    <section className="panel controls-panel">
      <div className="panel__header">
        <div>
          <h2>Control Room</h2>
          <p>Camera, calibration, privacy, and export controls.</p>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>Profile</span>
          <select value={activeProfileId ?? ""} onChange={(event) => setActiveProfileId(event.target.value || null)}>
            <option value="">No saved profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Profile name</span>
          <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Research participant A" />
        </label>
        <label>
          <span>Camera</span>
          <select value={cameraDeviceId ?? ""} onChange={(event) => setCameraDeviceId(event.target.value)}>
            <option value="">Default camera</option>
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Resolution</span>
          <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
            <option value="640x480">640 x 480</option>
            <option value="1280x720">1280 x 720</option>
          </select>
        </label>
        <label>
          <span>Frame cap</span>
          <input type="range" min="10" max="30" value={frameRateCap} onChange={(event) => setFrameRateCap(Number(event.target.value))} />
          <small>{frameRateCap} FPS target</small>
        </label>
        <label>
          <span>PERCLOS window</span>
          <input type="range" min="30000" max="180000" step="30000" value={perclosWindowMs} onChange={(event) => setPerclosWindowMs(Number(event.target.value))} />
          <small>{Math.round(perclosWindowMs / 1000)} sec</small>
        </label>
        <label>
          <span>Brightness</span>
          <input type="range" min="-30" max="30" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
        </label>
        <label>
          <span>Contrast</span>
          <input type="range" min="-30" max="30" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} />
        </label>
      </div>

      <label className="checkbox-row">
        <input type="checkbox" checked={soundAlerts} onChange={(event) => setSoundAlerts(event.target.checked)} />
        <span>Enable sound alerts</span>
      </label>

      <div className="button-grid">
        <button onClick={startCamera}>Start webcam</button>
        <button onClick={startDemo} className="button-secondary">Run demo mode</button>
        <button onClick={stopSession} className="button-secondary">Stop session</button>
        <button onClick={toggleRecording} className={recording ? "button-warning" : "button-secondary"}>
          {recording ? "Stop recording" : "Record overlay"}
        </button>
        <button onClick={takeSnapshot} className="button-secondary">Snapshot</button>
        <button onClick={() => startCalibration(profileName)} disabled={calibrationActive}>
          {calibrationActive ? "Calibrating..." : "Start calibration"}
        </button>
        <button onClick={() => saveProfile(profileName)} className="button-secondary">Save profile</button>
        <button onClick={exportFrameMetrics} className="button-secondary">Export frame CSV</button>
        <button onClick={exportEventMetrics} className="button-secondary">Export event CSV</button>
        <button onClick={exportSummary} className="button-secondary">Export summary JSON</button>
        <button onClick={clearSessionData} className="button-secondary">Delete session data</button>
      </div>

      <div className="disclaimer-block">
        <h3>Privacy and safety</h3>
        <p>This prototype keeps inference local in the browser, asks for camera permission explicitly, and labels outputs as visual estimates rather than diagnosis.</p>
      </div>
    </section>
  );
}
