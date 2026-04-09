export type EyeSide = "left" | "right" | "combined";
export type AppMode = "idle" | "camera" | "demo";
export type BlinkClassification = "full" | "partial" | "prolonged" | "noise";
export type ClosureClassification = "prolonged-closure" | "microsleep-candidate";
export type AlertLevel = "info" | "warning" | "critical";

export interface CameraSettings {
  deviceId?: string;
  width: number;
  height: number;
  frameRateCap: number;
  brightnessCompensation: number;
  contrastCompensation: number;
}

export interface AlertThresholds {
  perclosWarning: number;
  perclosCritical: number;
  fatigueWarning: number;
  fatigueCritical: number;
  lowTrackingConfidence: number;
  lowLightingScore: number;
  prolongedClosureMs: number;
  microsleepMs: number;
  yawnWarningPerMinute: number;
}

export interface DetectorThresholds {
  blinkClosed: number;
  blinkOpen: number;
  blinkMinDurationMs: number;
  blinkMaxDurationMs: number;
  fullBlinkDepth: number;
  reopeningStartDelta: number;
  yawnOpen: number;
  yawnClose: number;
  yawnMinDurationMs: number;
  talkingRejectDurationMs: number;
  perclosClosureThreshold: number;
  perclosWindowMs: number;
  smoothingAlpha: number;
  pupilLowConfidenceThreshold: number;
  prolongedClosureMs: number;
  microsleepMs: number;
}

export interface FatigueWeights {
  perclos: number;
  prolongedClosures: number;
  slowReopenings: number;
  yawnRate: number;
  gazeInstability: number;
  nodding: number;
  blinkRateDeviation: number;
}

export interface CalibrationProfile {
  id: string;
  name: string;
  createdAt: string;
  baselineEyeOpenness: number;
  baselineMouthRatio: number;
  baselinePupilDiameter: number;
  baselineLighting: number;
  notes: string;
}

export interface AppConfig {
  camera: CameraSettings;
  detector: DetectorThresholds;
  alerts: AlertThresholds;
  fatigueWeights: FatigueWeights;
  faceLandmarker: {
    wasmRoot: string;
    modelAssetPath: string;
    minFaceDetectionConfidence: number;
    minFacePresenceConfidence: number;
    minTrackingConfidence: number;
  };
  ui: {
    historyDurationMs: number;
    largeText: boolean;
    darkMode: boolean;
    confidenceBadges: boolean;
    tutorialMode: boolean;
    soundAlerts: boolean;
  };
}

export interface Point2D {
  x: number;
  y: number;
}

export interface EyeMetrics {
  opennessRatio: number;
  opennessPx: number;
  widthPx: number;
  closurePercent: number;
  irisDiameterPx: number;
  pupilDiameterPx: number | null;
  normalizedPupilDiameter: number | null;
  pupilConfidence: number;
  pupilCenter: Point2D | null;
  gazeOffset: Point2D | null;
}

export interface FaceTrackingMetrics {
  faceDetected: boolean;
  faceConfidence: number;
  trackingConfidence: number;
  faceBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  faceDistanceEstimate: number;
  motionBlurScore: number;
  occlusionScore: number;
  faceVisibilityConfidence: number;
}

export interface BlinkEvent {
  eventId: string;
  startTime: number;
  peakTime: number;
  endTime: number;
  duration: number;
  closingDuration: number;
  reopeningDuration: number;
  reopeningDelay: number;
  blinkSpeedClose: number;
  blinkSpeedOpen: number;
  closureDepth: number;
  confidence: number;
  classification: BlinkClassification;
  leftClosurePeak: number;
  rightClosurePeak: number;
  asymmetry: number;
}

export interface YawnEvent {
  eventId: string;
  startTime: number;
  endTime: number;
  duration: number;
  maxMouthOpening: number;
  confidence: number;
}

export interface ClosureEvent {
  eventId: string;
  startTime: number;
  endTime: number;
  duration: number;
  classification: ClosureClassification;
  confidence: number;
}

export interface NodEvent {
  eventId: string;
  startTime: number;
  endTime: number;
  duration: number;
  pitchAmplitude: number;
  confidence: number;
}

export interface AlertRecord {
  id: string;
  timestamp: number;
  level: AlertLevel;
  title: string;
  message: string;
}

export interface FrameMetric {
  timestamp: number;
  frameIndex: number;
  fps: number;
  faceDetected: boolean;
  faceConfidence: number;
  trackingConfidence: number;
  leftEyeOpenness: number;
  rightEyeOpenness: number;
  combinedOpenness: number;
  leftClosurePercent: number;
  rightClosurePercent: number;
  combinedClosurePercent: number;
  leftPupilDiameter: number | null;
  rightPupilDiameter: number | null;
  leftPupilConfidence: number;
  rightPupilConfidence: number;
  averagePupilDiameter: number | null;
  normalizedPupilDiameter: number | null;
  pupilVariability: number;
  mouthOpening: number;
  yawnActive: boolean;
  blinkState: string;
  perclosLeft: number;
  perclosRight: number;
  perclosCombined: number;
  fatigueIndex: number;
  gazeInstability: number;
  gazeOffsetX: number;
  gazeOffsetY: number;
  pitch: number;
  yaw: number;
  roll: number;
  faceDistanceEstimate: number;
  lightingScore: number;
  trackingQuality: number;
  motionBlurScore: number;
  faceVisibilityConfidence: number;
  leftEyeClosureFlag: boolean;
  rightEyeClosureFlag: boolean;
  combinedClosureFlag: boolean;
}

export interface SessionSummary {
  startedAt: string;
  endedAt: string;
  totalSessionDurationSec: number;
  totalFrames: number;
  avgFps: number;
  totalBlinks: number;
  blinkRatePerMinute: number;
  avgBlinkDurationMs: number;
  maxBlinkDurationMs: number;
  avgReopeningDelayMs: number;
  avgBlinkAsymmetry: number;
  slowBlinkCount: number;
  prolongedClosures: number;
  microsleepCandidates: number;
  avgLeftPupilDiameter: number | null;
  avgRightPupilDiameter: number | null;
  pupilVariability: number;
  totalYawns: number;
  totalYawnDurationMs: number;
  maxPerclos: number;
  avgPerclos: number;
  fatigueAverage: number;
  fatiguePeak: number;
  headNodCount: number;
  dataQualityAverage: number;
  lowConfidenceFrameRate: number;
  alertCount: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number | null;
}

export interface CalibrationSample {
  timestamp: number;
  openness: number;
  mouthRatio: number;
  pupilDiameter: number | null;
  lightingScore: number;
}

export interface LiveAnalysisState {
  mode: AppMode;
  statusText: string;
  face: FaceTrackingMetrics;
  leftEye: EyeMetrics;
  rightEye: EyeMetrics;
  mouthOpening: number;
  blinkState: string;
  yawnState: string;
  currentBlink: BlinkEvent | null;
  currentYawn: YawnEvent | null;
  lastBlink: BlinkEvent | null;
  lastYawn: YawnEvent | null;
  lastClosure: ClosureEvent | null;
  lastNod: NodEvent | null;
  blinkCount: number;
  blinkRatePerMinute: number;
  yawnCount: number;
  prolongedClosureCount: number;
  perclos: {
    left: number;
    right: number;
    combined: number;
  };
  fatigueIndex: number;
  lightingScore: number;
  gazeInstability: number;
  frameIndex: number;
  fps: number;
  confidenceScore: number;
  currentTimestamp: number;
  alerts: AlertRecord[];
}
