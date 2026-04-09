import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultConfig, STORAGE_KEYS } from "../config/defaultConfig";
import {
  buildDemoBlink,
  buildDemoClosure,
  buildDemoNod,
  buildDemoState,
  buildDemoYawn,
} from "../demo/demoDriver";
import { createFaceLandmarker, detectFaceForVideo } from "../detection/faceLandmarker";
import { computeFaceSignals } from "../detection/landmarkAnalysis";
import { estimatePupilDiameter } from "../detection/pupilEstimator";
import { BlinkStateMachine } from "../events/blinkStateMachine";
import { ClosureStateMachine } from "../events/closureStateMachine";
import { HeadNodStateMachine } from "../events/headNodStateMachine";
import { YawnStateMachine } from "../events/yawnStateMachine";
import { computeFatigueIndex } from "../metrics/fatigueIndex";
import { detectGazeInstability } from "../metrics/headPose";
import { PerclosTracker, RollingTimeSeries } from "../metrics/rollingWindow";
import { computeLightingAndBlur } from "../metrics/quality";
import { exportEventMetricsCsv, exportFrameMetricsCsv, exportSessionSummary } from "../storage/exporters";
import { SessionStore } from "../storage/sessionStore";
import type {
  AlertRecord,
  AppConfig,
  CalibrationProfile,
  FrameMetric,
  LiveAnalysisState,
  SessionSummary,
  TimeSeriesPoint,
} from "../types/domain";
import { makeId } from "../utils/id";
import { average, clamp, smoothValue, stdDev } from "../utils/math";
import { drawAnalysisFrame, drawDemoFrame } from "../utils/overlay";
import { readJsonStorage, writeJsonStorage } from "../utils/storage";

interface BaselineState {
  eyeOpenness: number;
  mouthOpening: number;
  pupilDiameter: number;
}

interface ChartState {
  openness: TimeSeriesPoint[];
  pupil: TimeSeriesPoint[];
  perclos: TimeSeriesPoint[];
  mouth: TimeSeriesPoint[];
  fatigue: TimeSeriesPoint[];
}

interface CalibrationState {
  active: boolean;
  startedAt: number;
  name: string;
  samples: Array<{
    openness: number;
    mouthOpening: number;
    pupilDiameter: number | null;
    lightingScore: number;
  }>;
}

const initialLiveState: LiveAnalysisState = {
  mode: "idle",
  statusText: "Waiting to start",
  face: {
    faceDetected: false,
    faceConfidence: 0,
    trackingConfidence: 0,
    faceBox: null,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    faceDistanceEstimate: 0,
    motionBlurScore: 0,
    occlusionScore: 0,
    faceVisibilityConfidence: 0,
  },
  leftEye: {
    opennessRatio: 0,
    opennessPx: 0,
    widthPx: 0,
    closurePercent: 0,
    irisDiameterPx: 0,
    pupilDiameterPx: null,
    normalizedPupilDiameter: null,
    pupilConfidence: 0,
    pupilCenter: null,
    gazeOffset: null,
  },
  rightEye: {
    opennessRatio: 0,
    opennessPx: 0,
    widthPx: 0,
    closurePercent: 0,
    irisDiameterPx: 0,
    pupilDiameterPx: null,
    normalizedPupilDiameter: null,
    pupilConfidence: 0,
    pupilCenter: null,
    gazeOffset: null,
  },
  mouthOpening: 0,
  blinkState: "open",
  yawnState: "idle",
  currentBlink: null,
  currentYawn: null,
  lastBlink: null,
  lastYawn: null,
  lastClosure: null,
  lastNod: null,
  blinkCount: 0,
  blinkRatePerMinute: 0,
  yawnCount: 0,
  prolongedClosureCount: 0,
  perclos: { left: 0, right: 0, combined: 0 },
  fatigueIndex: 0,
  lightingScore: 0,
  gazeInstability: 0,
  frameIndex: 0,
  fps: 0,
  confidenceScore: 0,
  currentTimestamp: 0,
  alerts: [],
};

function createBlinkMachine(config: AppConfig): BlinkStateMachine {
  return new BlinkStateMachine({
    closedThreshold: config.detector.blinkClosed,
    openThreshold: config.detector.blinkOpen,
    minDurationMs: config.detector.blinkMinDurationMs,
    maxDurationMs: config.detector.blinkMaxDurationMs,
    fullBlinkDepth: config.detector.fullBlinkDepth,
    reopeningStartDelta: config.detector.reopeningStartDelta,
  });
}

function createYawnMachine(config: AppConfig): YawnStateMachine {
  return new YawnStateMachine({
    openThreshold: config.detector.yawnOpen,
    closeThreshold: config.detector.yawnClose,
    minDurationMs: config.detector.yawnMinDurationMs,
    talkingRejectDurationMs: config.detector.talkingRejectDurationMs,
  });
}

export function useAnalysisSession() {
  const [config, setConfig] = useState<AppConfig>(() =>
    readJsonStorage(STORAGE_KEYS.config, defaultConfig),
  );
  const [profiles, setProfiles] = useState<CalibrationProfile[]>(() =>
    readJsonStorage(STORAGE_KEYS.profiles, []),
  );
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    readJsonStorage(STORAGE_KEYS.activeProfileId, null),
  );
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [liveState, setLiveState] = useState<LiveAnalysisState>(initialLiveState);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [chartState, setChartState] = useState<ChartState>({
    openness: [],
    pupil: [],
    perclos: [],
    mouth: [],
    fatigue: [],
  });
  const [recording, setRecording] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationState>({
    active: false,
    startedAt: 0,
    name: "Default profile",
    samples: [],
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoFrameCallbackRef = useRef<number | null>(null);
  const processFaceFrameRef = useRef<((timestamp: number) => Promise<void>) | null>(
    null,
  );
  const lastProcessMsRef = useRef(0);
  const lastChartUpdateRef = useRef(0);
  const liveStateRef = useRef<LiveAnalysisState>(initialLiveState);
  const calibrationRef = useRef<CalibrationState>({
    active: false,
    startedAt: 0,
    name: "Default profile",
    samples: [],
  });
  const sessionStoreRef = useRef(new SessionStore());
  const baselineRef = useRef<BaselineState>({
    eyeOpenness: 0.28,
    mouthOpening: 0.14,
    pupilDiameter: 8,
  });
  const lastAlertsRef = useRef<Record<string, number>>({});
  const gazeOffsetsRef = useRef<Array<{ x: number; y: number }>>([]);
  const chartSeriesRef = useRef({
    openness: new RollingTimeSeries(config.ui.historyDurationMs),
    pupil: new RollingTimeSeries(config.ui.historyDurationMs),
    perclos: new RollingTimeSeries(config.ui.historyDurationMs),
    mouth: new RollingTimeSeries(config.ui.historyDurationMs),
    fatigue: new RollingTimeSeries(config.ui.historyDurationMs),
  });
  const blinkMachineRef = useRef(createBlinkMachine(config));
  const yawnMachineRef = useRef(createYawnMachine(config));
  const closureMachineRef = useRef(
    new ClosureStateMachine({
      threshold: config.detector.blinkClosed,
      releaseThreshold: config.detector.blinkOpen,
      prolongedClosureMs: config.detector.prolongedClosureMs,
      microsleepMs: config.detector.microsleepMs,
    }),
  );
  const nodMachineRef = useRef(
    new HeadNodStateMachine({
      minAmplitudeDeg: 14,
      maxDurationMs: 1400,
    }),
  );
  const perclosTrackerRef = useRef(new PerclosTracker(config.detector.perclosWindowMs));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const faceLandmarkerPromiseRef = useRef<ReturnType<typeof createFaceLandmarker> | null>(null);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [profiles, activeProfileId],
  );

  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  const applyCalibrationBaseline = useCallback((profile: CalibrationProfile | null) => {
    if (!profile) {
      baselineRef.current = {
        eyeOpenness: 0.28,
        mouthOpening: 0.14,
        pupilDiameter: 8,
      };
      return;
    }
    baselineRef.current = {
      eyeOpenness: profile.baselineEyeOpenness,
      mouthOpening: profile.baselineMouthRatio,
      pupilDiameter: profile.baselinePupilDiameter,
    };
  }, []);

  useEffect(() => {
    applyCalibrationBaseline(activeProfile);
  }, [activeProfile, applyCalibrationBaseline]);

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.config, config);
    blinkMachineRef.current = createBlinkMachine(config);
    yawnMachineRef.current = createYawnMachine(config);
    closureMachineRef.current = new ClosureStateMachine({
      threshold: config.detector.blinkClosed,
      releaseThreshold: config.detector.blinkOpen,
      prolongedClosureMs: config.detector.prolongedClosureMs,
      microsleepMs: config.detector.microsleepMs,
    });
    perclosTrackerRef.current = new PerclosTracker(config.detector.perclosWindowMs);
    chartSeriesRef.current = {
      openness: new RollingTimeSeries(config.ui.historyDurationMs),
      pupil: new RollingTimeSeries(config.ui.historyDurationMs),
      perclos: new RollingTimeSeries(config.ui.historyDurationMs),
      mouth: new RollingTimeSeries(config.ui.historyDurationMs),
      fatigue: new RollingTimeSeries(config.ui.historyDurationMs),
    };
  }, [config]);

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.profiles, profiles);
  }, [profiles]);

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.activeProfileId, activeProfileId);
  }, [activeProfileId]);

  const refreshDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(mediaDevices.filter((device) => device.kind === "videoinput"));
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    if (typeof BroadcastChannel !== "undefined") {
      broadcastChannelRef.current = new BroadcastChannel(
        "face-fatigue-detector-live",
      );
    }
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      broadcastChannelRef.current?.close();
    };
  }, [refreshDevices]);

  const beepAlert = useCallback(() => {
    if (!config.ui.soundAlerts) {
      return;
    }
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 740;
      gain.gain.value = 0.03;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch {
      // Ignore audio issues.
    }
  }, [config.ui.soundAlerts]);

  const addAlert = useCallback(
    (level: AlertRecord["level"], title: string, message: string, timestamp: number) => {
      const key = `${level}:${title}`;
      const lastTimestamp = lastAlertsRef.current[key] ?? 0;
      if (timestamp - lastTimestamp < 6000) {
        return;
      }
      lastAlertsRef.current[key] = timestamp;
      const alert: AlertRecord = {
        id: makeId("alert"),
        timestamp,
        level,
        title,
        message,
      };
      sessionStoreRef.current.recordAlert(alert);
      beepAlert();
      setLiveState((previous) => ({
        ...previous,
        alerts: [alert, ...previous.alerts].slice(0, 8),
      }));
    },
    [beepAlert],
  );

  const stopLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const video = videoRef.current as
      | (HTMLVideoElement & {
          cancelVideoFrameCallback?: (handle: number) => void;
        })
      | null;
    if (
      videoFrameCallbackRef.current !== null &&
      video?.cancelVideoFrameCallback
    ) {
      video.cancelVideoFrameCallback(videoFrameCallbackRef.current);
      videoFrameCallbackRef.current = null;
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const finalizeRecording = useCallback(() => {
    if (!recordingChunksRef.current.length) {
      setRecording(false);
      return;
    }
    const blob = new Blob(recordingChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || "video/webm",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `overlay-recording-${Date.now()}.webm`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    recordingChunksRef.current = [];
    setRecording(false);
  }, []);

  const publishFrame = useCallback((frameMetric: FrameMetric) => {
    window.dispatchEvent(
      new CustomEvent("face-fatigue-live", {
        detail: frameMetric,
      }),
    );
    broadcastChannelRef.current?.postMessage(frameMetric);
  }, []);

  const pushChartPoints = useCallback(
    (timestamp: number, openness: number, pupil: number | null, perclos: number, mouth: number, fatigue: number) => {
      chartSeriesRef.current.openness.push(timestamp, openness);
      chartSeriesRef.current.pupil.push(timestamp, pupil);
      chartSeriesRef.current.perclos.push(timestamp, perclos);
      chartSeriesRef.current.mouth.push(timestamp, mouth);
      chartSeriesRef.current.fatigue.push(timestamp, fatigue);

      if (timestamp - lastChartUpdateRef.current >= 180) {
        lastChartUpdateRef.current = timestamp;
        setChartState({
          openness: chartSeriesRef.current.openness.values(),
          pupil: chartSeriesRef.current.pupil.values(),
          perclos: chartSeriesRef.current.perclos.values(),
          mouth: chartSeriesRef.current.mouth.values(),
          fatigue: chartSeriesRef.current.fatigue.values(),
        });
      }
    },
    [],
  );

  const resetSessionStore = useCallback(() => {
    sessionStoreRef.current = new SessionStore();
    setSessionSummary(null);
    setChartState({
      openness: [],
      pupil: [],
      perclos: [],
      mouth: [],
      fatigue: [],
    });
    chartSeriesRef.current = {
      openness: new RollingTimeSeries(config.ui.historyDurationMs),
      pupil: new RollingTimeSeries(config.ui.historyDurationMs),
      perclos: new RollingTimeSeries(config.ui.historyDurationMs),
      mouth: new RollingTimeSeries(config.ui.historyDurationMs),
      fatigue: new RollingTimeSeries(config.ui.historyDurationMs),
    };
    setLiveState(initialLiveState);
    lastAlertsRef.current = {};
    gazeOffsetsRef.current = [];
    blinkMachineRef.current.reset();
    yawnMachineRef.current.reset();
    closureMachineRef.current.reset();
    nodMachineRef.current.reset();
  }, [config.ui.historyDurationMs]);

  const stopSession = useCallback(() => {
    stopLoop();
    stopMediaStream();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    lastProcessMsRef.current = 0;
    setRecording(false);
    setLiveState((previous) => ({
      ...previous,
      mode: "idle",
      statusText: "Session stopped",
    }));
    setSessionSummary(sessionStoreRef.current.buildSummary());
  }, [stopLoop, stopMediaStream]);

  useEffect(() => stopSession, [stopSession]);

  const updateCalibration = useCallback(
    (
      timestamp: number,
      openness: number,
      mouthOpening: number,
      pupilDiameter: number | null,
      lightingScore: number,
    ) => {
      setCalibration((previous) => {
        if (!previous.active) {
          return previous;
        }
        const nextSamples = [
          ...previous.samples,
          {
            openness,
            mouthOpening,
            pupilDiameter,
            lightingScore,
          },
        ];

        if (timestamp - previous.startedAt < 5000) {
          return {
            ...previous,
            samples: nextSamples,
          };
        }

        const profile: CalibrationProfile = {
          id: activeProfileId ?? makeId("profile"),
          name: previous.name.trim() || "Default profile",
          createdAt: new Date().toISOString(),
          baselineEyeOpenness:
            average(nextSamples.map((sample) => sample.openness)) ??
            baselineRef.current.eyeOpenness,
          baselineMouthRatio:
            average(nextSamples.map((sample) => sample.mouthOpening)) ??
            baselineRef.current.mouthOpening,
          baselinePupilDiameter:
            average(
              nextSamples
                .map((sample) => sample.pupilDiameter)
                .filter((value): value is number => value !== null),
            ) ?? baselineRef.current.pupilDiameter,
          baselineLighting:
            average(nextSamples.map((sample) => sample.lightingScore)) ?? 0.5,
          notes: "Calibrated from a 5-second neutral capture.",
        };

        setProfiles((current) => {
          const remaining = current.filter((entry) => entry.id !== profile.id);
          return [profile, ...remaining];
        });
        setActiveProfileId(profile.id);
        applyCalibrationBaseline(profile);
        setLiveState((current) => ({
          ...current,
          statusText: `Calibration saved for ${profile.name}`,
        }));

        return {
          active: false,
          startedAt: 0,
          name: profile.name,
          samples: [],
        };
      });
    },
    [activeProfileId, applyCalibrationBaseline],
  );

  const scheduleNextCameraFrame = useCallback(() => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (
            callback: (now: number, metadata: unknown) => void,
          ) => number;
        })
      | null;

    if (video?.requestVideoFrameCallback) {
      videoFrameCallbackRef.current = video.requestVideoFrameCallback(() => {
        videoFrameCallbackRef.current = null;
        void processFaceFrameRef.current?.(performance.now());
      });
      return;
    }

    animationFrameRef.current = requestAnimationFrame((nextTimestamp) => {
      void processFaceFrameRef.current?.(nextTimestamp);
    });
  }, []);

  const processFaceFrame = useCallback(
    async (timestamp: number) => {
      const liveState = liveStateRef.current;
      const calibration = calibrationRef.current;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      if (!faceLandmarkerPromiseRef.current) {
        faceLandmarkerPromiseRef.current = createFaceLandmarker(config).catch(
          (error) => {
            faceLandmarkerPromiseRef.current = null;
            throw error;
          },
        );
      }

      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        scheduleNextCameraFrame();
        return;
      }

      const targetInterval = 1000 / Math.max(1, config.camera.frameRateCap);
      if (timestamp - lastProcessMsRef.current < targetInterval) {
        scheduleNextCameraFrame();
        return;
      }

      try {
        lastProcessMsRef.current = timestamp;

        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        drawAnalysisFrame({
          context,
          canvas,
          video,
          brightnessCompensation: config.camera.brightnessCompensation,
          contrastCompensation: config.camera.contrastCompensation,
          signals: null,
          state: liveState,
        });

        const landmarker = await faceLandmarkerPromiseRef.current;
        const result = detectFaceForVideo(landmarker, video, performance.now());
        const signals = computeFaceSignals(result, canvas.width, canvas.height);

        if (!signals) {
          drawAnalysisFrame({
            context,
            canvas,
            video,
            brightnessCompensation: config.camera.brightnessCompensation,
            contrastCompensation: config.camera.contrastCompensation,
            signals: null,
            state: {
              ...liveState,
              face: {
                ...liveState.face,
                faceDetected: false,
              },
            },
          });

          addAlert(
            "warning",
            "Tracking lost",
            "Face landmarks are not stable enough for analysis.",
            timestamp,
          );
          setLiveState((previous) => ({
            ...previous,
            mode: "camera",
            statusText: "Waiting for a clear face view",
            face: {
              ...previous.face,
              faceDetected: false,
            },
          }));

          scheduleNextCameraFrame();
          return;
        }

        const lighting = computeLightingAndBlur(context, signals.face.faceBox);
        signals.face.motionBlurScore = lighting.blurScore;
        signals.face.occlusionScore = lighting.occlusionScore;

      const leftPupil = estimatePupilDiameter({
        context,
        eyeOutline: signals.leftEye.eyeOutline,
        irisCenter: signals.leftEye.irisCenter,
        irisDiameterPx: signals.leftEye.irisDiameterPx,
      });
      const rightPupil = estimatePupilDiameter({
        context,
        eyeOutline: signals.rightEye.eyeOutline,
        irisCenter: signals.rightEye.irisCenter,
        irisDiameterPx: signals.rightEye.irisDiameterPx,
      });

      const combinedOpenness =
        average([
          signals.leftEye.eyeMetrics.opennessRatio,
          signals.rightEye.eyeMetrics.opennessRatio,
        ]) ?? 0;

      if (combinedOpenness > baselineRef.current.eyeOpenness * 0.85) {
        baselineRef.current.eyeOpenness = smoothValue(
          baselineRef.current.eyeOpenness,
          combinedOpenness,
          0.025,
        );
      }
      if (
        signals.mouthOpening <
        Math.max(0.32, baselineRef.current.mouthOpening * 2)
      ) {
        baselineRef.current.mouthOpening = smoothValue(
          baselineRef.current.mouthOpening,
          signals.mouthOpening,
          0.03,
        );
      }
      const averagePupil = average([leftPupil.diameterPx, rightPupil.diameterPx]);
      if (
        averagePupil !== null &&
        (average([leftPupil.confidence, rightPupil.confidence]) ?? 0) > 0.55
      ) {
        baselineRef.current.pupilDiameter = smoothValue(
          baselineRef.current.pupilDiameter,
          averagePupil,
          0.03,
        );
      }

      const leftClosure = clamp(
        1 -
          signals.leftEye.eyeMetrics.opennessRatio /
            Math.max(0.01, baselineRef.current.eyeOpenness),
        0,
        1,
      );
      const rightClosure = clamp(
        1 -
          signals.rightEye.eyeMetrics.opennessRatio /
            Math.max(0.01, baselineRef.current.eyeOpenness),
        0,
        1,
      );
      const combinedClosure = clamp((leftClosure + rightClosure) / 2, 0, 1);

      const trackingConfidence = clamp(
        signals.face.faceVisibilityConfidence * 0.32 +
          lighting.lightingScore * 0.2 +
          (1 - lighting.blurScore) * 0.14 +
          (1 - lighting.occlusionScore) * 0.14 +
          (average([leftPupil.confidence, rightPupil.confidence]) ?? 0.35) * 0.2,
        0,
        1,
      );
      signals.face.faceConfidence = trackingConfidence;
      signals.face.trackingConfidence = trackingConfidence;

      const gazeOffset = {
        x:
          average([
            signals.leftEye.eyeMetrics.gazeOffset?.x,
            signals.rightEye.eyeMetrics.gazeOffset?.x,
          ]) ?? 0,
        y:
          average([
            signals.leftEye.eyeMetrics.gazeOffset?.y,
            signals.rightEye.eyeMetrics.gazeOffset?.y,
          ]) ?? 0,
      };
      gazeOffsetsRef.current.push(gazeOffset);
      if (gazeOffsetsRef.current.length > 45) {
        gazeOffsetsRef.current.shift();
      }
      const gazeInstability = detectGazeInstability(gazeOffsetsRef.current);

      const blink = blinkMachineRef.current.update({
        timestamp,
        leftClosure,
        rightClosure,
        combinedClosure,
        trackingConfidence,
      });
      const yawn = yawnMachineRef.current.update({
        timestamp,
        mouthOpening: signals.mouthOpening,
        trackingConfidence,
      });
      const closure = closureMachineRef.current.update({
        timestamp,
        combinedClosure,
        trackingConfidence,
      });
      const nod = nodMachineRef.current.update(
        timestamp,
        signals.face.headPose.pitch,
      );

      if (blink.event) {
        sessionStoreRef.current.recordBlink(blink.event);
      }
      if (yawn.event) {
        sessionStoreRef.current.recordYawn(yawn.event);
      }
      if (closure) {
        sessionStoreRef.current.recordClosure(closure);
      }
      if (nod) {
        sessionStoreRef.current.recordNod(nod);
      }

      const perclos = perclosTrackerRef.current.push({
        timestamp,
        leftClosed: leftClosure >= config.detector.perclosClosureThreshold,
        rightClosed: rightClosure >= config.detector.perclosClosureThreshold,
        combinedClosed:
          combinedClosure >= config.detector.perclosClosureThreshold,
      });

      const blinkRateMinute = sessionStoreRef.current.blinkEvents.filter(
        (event) => timestamp - event.endTime <= 60000,
      ).length;
      const yawnRateMinute = sessionStoreRef.current.yawnEvents.filter(
        (event) => timestamp - event.endTime <= 60000,
      ).length;
      const recentBlinks = sessionStoreRef.current.blinkEvents.filter(
        (event) => timestamp - event.endTime <= 120000,
      );
      const slowReopeningRate =
        recentBlinks.length > 0
          ? recentBlinks.filter((event) => event.reopeningDelay > 120).length /
            recentBlinks.length
          : 0;
      const prolongedClosureRate =
        sessionStoreRef.current.closureEvents.filter(
          (event) => timestamp - event.endTime <= 120000,
        ).length / 3;
      const noddingRate =
        sessionStoreRef.current.nodEvents.filter(
          (event) => timestamp - event.endTime <= 120000,
        ).length / 4;
      const blinkRateDeviation = clamp(
        Math.abs(blinkRateMinute - 12) / 12,
        0,
        1,
      );
      const fatigueIndex = computeFatigueIndex(
        {
          perclos: perclos.combined,
          prolongedClosureRate: clamp(prolongedClosureRate, 0, 1),
          slowReopeningRate,
          yawnRate: clamp(yawnRateMinute / 4, 0, 1),
          gazeInstability,
          noddingRate: clamp(noddingRate, 0, 1),
          blinkRateDeviation,
        },
        config.fatigueWeights,
      );

      const pupilValues = sessionStoreRef.current.frames
        .filter((frame) => timestamp - frame.timestamp <= 60000)
        .map((frame) => frame.averagePupilDiameter)
        .filter((value): value is number => value !== null);
      if (averagePupil !== null) {
        pupilValues.push(averagePupil);
      }
      const pupilVariability = stdDev(pupilValues);
      const fps = liveState.currentTimestamp
        ? 1000 / Math.max(1, timestamp - liveState.currentTimestamp)
        : config.camera.frameRateCap;

      const frameMetric: FrameMetric = {
        timestamp,
        frameIndex: liveState.frameIndex + 1,
        fps,
        faceDetected: true,
        faceConfidence: trackingConfidence,
        trackingConfidence,
        leftEyeOpenness: signals.leftEye.eyeMetrics.opennessRatio,
        rightEyeOpenness: signals.rightEye.eyeMetrics.opennessRatio,
        combinedOpenness,
        leftClosurePercent: leftClosure,
        rightClosurePercent: rightClosure,
        combinedClosurePercent: combinedClosure,
        leftPupilDiameter: leftPupil.diameterPx,
        rightPupilDiameter: rightPupil.diameterPx,
        leftPupilConfidence: leftPupil.confidence,
        rightPupilConfidence: rightPupil.confidence,
        averagePupilDiameter: averagePupil,
        normalizedPupilDiameter: average([
          leftPupil.normalizedDiameter,
          rightPupil.normalizedDiameter,
        ]),
        pupilVariability,
        mouthOpening: signals.mouthOpening,
        yawnActive: yawn.state === "yawning",
        blinkState: blink.state,
        perclosLeft: perclos.left,
        perclosRight: perclos.right,
        perclosCombined: perclos.combined,
        fatigueIndex,
        gazeInstability,
        gazeOffsetX: gazeOffset.x,
        gazeOffsetY: gazeOffset.y,
        pitch: signals.face.headPose.pitch,
        yaw: signals.face.headPose.yaw,
        roll: signals.face.headPose.roll,
        faceDistanceEstimate: signals.face.faceDistanceEstimate,
        lightingScore: lighting.lightingScore,
        trackingQuality: trackingConfidence,
        motionBlurScore: lighting.blurScore,
        faceVisibilityConfidence: signals.face.faceVisibilityConfidence,
        leftEyeClosureFlag:
          leftClosure >= config.detector.perclosClosureThreshold,
        rightEyeClosureFlag:
          rightClosure >= config.detector.perclosClosureThreshold,
        combinedClosureFlag:
          combinedClosure >= config.detector.perclosClosureThreshold,
      };

      sessionStoreRef.current.recordFrame(frameMetric);
      publishFrame(frameMetric);
      pushChartPoints(
        timestamp,
        combinedOpenness,
        averagePupil,
        perclos.combined,
        signals.mouthOpening,
        fatigueIndex,
      );

      if (perclos.combined >= config.alerts.perclosCritical) {
        addAlert(
          "critical",
          "PERCLOS critical",
          "Combined PERCLOS estimate crossed the critical threshold.",
          timestamp,
        );
      } else if (perclos.combined >= config.alerts.perclosWarning) {
        addAlert(
          "warning",
          "PERCLOS elevated",
          "Combined PERCLOS estimate is staying high in the rolling window.",
          timestamp,
        );
      }
      if (fatigueIndex >= config.alerts.fatigueCritical) {
        addAlert(
          "critical",
          "Fatigue index critical",
          "Experimental fatigue index reached the critical range.",
          timestamp,
        );
      } else if (fatigueIndex >= config.alerts.fatigueWarning) {
        addAlert(
          "warning",
          "Fatigue index elevated",
          "Experimental fatigue index reached the warning range.",
          timestamp,
        );
      }
      if (trackingConfidence <= config.alerts.lowTrackingConfidence) {
        addAlert(
          "warning",
          "Low confidence",
          "Tracking confidence is too low for stable pupil and blink estimates.",
          timestamp,
        );
      }
      if (lighting.lightingScore <= config.alerts.lowLightingScore) {
        addAlert(
          "info",
          "Lighting weak",
          "Lighting quality is reducing detection confidence.",
          timestamp,
        );
      }
      if (closure && closure.duration >= config.alerts.prolongedClosureMs) {
        addAlert(
          "warning",
          "Prolonged closure",
          "A prolonged eye closure event was detected.",
          timestamp,
        );
      }
      if (closure && closure.duration >= config.alerts.microsleepMs) {
        addAlert(
          "critical",
          "Microsleep candidate",
          "A very long closure crossed the microsleep-candidate threshold.",
          timestamp,
        );
      }
      if (yawnRateMinute >= config.alerts.yawnWarningPerMinute) {
        addAlert(
          "warning",
          "Frequent yawns",
          "Yawn frequency in the last minute crossed the configured threshold.",
          timestamp,
        );
      }

      updateCalibration(
        timestamp,
        combinedOpenness,
        signals.mouthOpening,
        averagePupil,
        lighting.lightingScore,
      );

      const nextState: LiveAnalysisState = {
        mode: "camera",
        statusText: calibration.active
          ? `Calibrating ${Math.max(
              0,
              5 - Math.floor((timestamp - calibration.startedAt) / 1000),
            )}s`
          : trackingConfidence > 0.5
            ? "Tracking active"
            : "Tracking noisy",
        face: signals.face,
        leftEye: {
          ...signals.leftEye.eyeMetrics,
          closurePercent: leftClosure,
          pupilDiameterPx: leftPupil.diameterPx,
          normalizedPupilDiameter: leftPupil.normalizedDiameter,
          pupilConfidence: leftPupil.confidence,
          pupilCenter: leftPupil.center,
        },
        rightEye: {
          ...signals.rightEye.eyeMetrics,
          closurePercent: rightClosure,
          pupilDiameterPx: rightPupil.diameterPx,
          normalizedPupilDiameter: rightPupil.normalizedDiameter,
          pupilConfidence: rightPupil.confidence,
          pupilCenter: rightPupil.center,
        },
        mouthOpening: signals.mouthOpening,
        blinkState: blink.state,
        yawnState: yawn.state,
        currentBlink: blink.active,
        currentYawn: yawn.active,
        lastBlink: blink.event ?? liveState.lastBlink,
        lastYawn: yawn.event ?? liveState.lastYawn,
        lastClosure: closure ?? liveState.lastClosure,
        lastNod: nod ?? liveState.lastNod,
        blinkCount: sessionStoreRef.current.blinkEvents.length,
        blinkRatePerMinute: blinkRateMinute,
        yawnCount: sessionStoreRef.current.yawnEvents.length,
        prolongedClosureCount: sessionStoreRef.current.closureEvents.length,
        perclos,
        fatigueIndex,
        lightingScore: lighting.lightingScore,
        gazeInstability,
        frameIndex: frameMetric.frameIndex,
        fps,
        confidenceScore: trackingConfidence,
        currentTimestamp: timestamp,
        alerts: [...sessionStoreRef.current.alerts].slice(-8).reverse(),
      };

      drawAnalysisFrame({
        context,
        canvas,
        video,
        brightnessCompensation: config.camera.brightnessCompensation,
        contrastCompensation: config.camera.contrastCompensation,
        signals,
        state: nextState,
      });

      setLiveState(nextState);
      if (
        frameMetric.frameIndex %
          Math.max(10, Math.round(config.camera.frameRateCap)) ===
        0
      ) {
        setSessionSummary(sessionStoreRef.current.buildSummary());
      }

        scheduleNextCameraFrame();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error("Frame processing failed", error);
        addAlert(
          "warning",
          "Processing stalled",
          `A frame-processing error occurred. ${message}`,
          timestamp,
        );
        setLiveState((previous) => ({
          ...previous,
          mode: "camera",
          statusText: `Recovering: ${message.slice(0, 72)}`,
        }));
        scheduleNextCameraFrame();
      }
    },
    [
      addAlert,
      config,
      publishFrame,
      pushChartPoints,
      scheduleNextCameraFrame,
      updateCalibration,
    ],
  );

  useEffect(() => {
    processFaceFrameRef.current = processFaceFrame;
  }, [processFaceFrame]);

  const processDemoFrame = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      if (
        canvas.width !== config.camera.width ||
        canvas.height !== config.camera.height
      ) {
        canvas.width = config.camera.width;
        canvas.height = config.camera.height;
      }

      const nextPartial = buildDemoState(timestamp, liveState.frameIndex + 1);
      const nextState: LiveAnalysisState = {
        ...liveState,
        ...nextPartial,
        currentTimestamp: timestamp,
        face: {
          ...liveState.face,
          faceDetected: true,
          faceConfidence: 0.84,
          trackingConfidence: 0.84,
        },
        leftEye: {
          ...liveState.leftEye,
          opennessRatio: 0.26,
          opennessPx: 13,
          widthPx: 42,
          closurePercent: nextPartial.perclos?.left ?? 0,
          irisDiameterPx: 11,
          pupilDiameterPx: 4.8,
          normalizedPupilDiameter: 0.43,
          pupilConfidence: 0.77,
          pupilCenter: {
            x: canvas.width / 2 - 130,
            y: canvas.height / 2 - 40,
          },
          gazeOffset: { x: 0.02, y: 0.01 },
        },
        rightEye: {
          ...liveState.rightEye,
          opennessRatio: 0.27,
          opennessPx: 13,
          widthPx: 42,
          closurePercent: nextPartial.perclos?.right ?? 0,
          irisDiameterPx: 11,
          pupilDiameterPx: 4.7,
          normalizedPupilDiameter: 0.42,
          pupilConfidence: 0.76,
          pupilCenter: {
            x: canvas.width / 2 + 130,
            y: canvas.height / 2 - 40,
          },
          gazeOffset: { x: -0.01, y: 0.01 },
        },
      };

      if (Math.round(timestamp / 1000) % 4 === 0) {
        nextState.lastBlink = buildDemoBlink(timestamp);
      }
      if (Math.round(timestamp / 1000) % 19 === 0) {
        nextState.lastYawn = buildDemoYawn(timestamp);
        nextState.lastClosure = buildDemoClosure(timestamp);
        nextState.lastNod = buildDemoNod(timestamp);
      }

      drawDemoFrame(context, canvas, nextState);
      pushChartPoints(
        timestamp,
        0.26,
        4.75,
        nextState.perclos.combined,
        nextState.mouthOpening,
        nextState.fatigueIndex,
      );
      setLiveState(nextState);
      animationFrameRef.current = requestAnimationFrame(processDemoFrame);
    },
    [config.camera.height, config.camera.width, liveState, pushChartPoints],
  );

  const startCamera = useCallback(async () => {
    resetSessionStore();
    stopLoop();
    stopMediaStream();

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        deviceId: config.camera.deviceId
          ? { exact: config.camera.deviceId }
          : undefined,
        width: { ideal: config.camera.width },
        height: { ideal: config.camera.height },
        frameRate: { ideal: config.camera.frameRateCap },
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      throw new Error("Video element missing");
    }

    video.srcObject = stream;
    await video.play();
    await refreshDevices();
    setLiveState((previous) => ({
      ...previous,
      mode: "camera",
      statusText: "Camera ready",
    }));
    scheduleNextCameraFrame();
  }, [
    config.camera,
    refreshDevices,
    resetSessionStore,
    scheduleNextCameraFrame,
    stopLoop,
    stopMediaStream,
  ]);

  const startDemo = useCallback(() => {
    resetSessionStore();
    stopLoop();
    stopMediaStream();
    setLiveState((previous) => ({
      ...previous,
      mode: "demo",
      statusText: "Demo mode active",
    }));
    animationFrameRef.current = requestAnimationFrame(processDemoFrame);
  }, [processDemoFrame, resetSessionStore, stopLoop, stopMediaStream]);

  const toggleRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      return;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      return;
    }

    const stream = canvas.captureStream(config.camera.frameRateCap);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = finalizeRecording;
    recorder.start(400);
    mediaRecorderRef.current = recorder;
    setRecording(true);
  }, [config.camera.frameRateCap, finalizeRecording]);

  const takeSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `snapshot-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  const startCalibration = useCallback(
    (name: string) => {
      setCalibration({
        active: true,
        startedAt: performance.now(),
        name: name.trim() || activeProfile?.name || "Default profile",
        samples: [],
      });
    },
    [activeProfile?.name],
  );

  const clearSessionData = useCallback(() => {
    resetSessionStore();
    setLiveState(initialLiveState);
    setSessionSummary(null);
  }, [resetSessionStore]);

  const updateConfig = useCallback((updater: (current: AppConfig) => AppConfig) => {
    setConfig((current) => updater(current));
  }, []);

  const saveProfile = useCallback(
    (name: string) => {
      const profile: CalibrationProfile = {
        id: activeProfileId ?? makeId("profile"),
        name,
        createdAt: new Date().toISOString(),
        baselineEyeOpenness: baselineRef.current.eyeOpenness,
        baselineMouthRatio: baselineRef.current.mouthOpening,
        baselinePupilDiameter: baselineRef.current.pupilDiameter,
        baselineLighting: liveState.lightingScore,
        notes: "Saved from current runtime baseline.",
      };
      setProfiles((current) => {
        const remaining = current.filter((entry) => entry.id !== profile.id);
        return [profile, ...remaining];
      });
      setActiveProfileId(profile.id);
    },
    [activeProfileId, liveState.lightingScore],
  );

  return {
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
    activeProfile,
    recording,
    calibration,
    sessionSummary,
    blinkEvents: sessionStoreRef.current.blinkEvents,
    yawnEvents: sessionStoreRef.current.yawnEvents,
    closureEvents: sessionStoreRef.current.closureEvents,
    nodEvents: sessionStoreRef.current.nodEvents,
    refreshDevices,
    startCamera,
    startDemo,
    stopSession,
    toggleRecording,
    takeSnapshot,
    exportFrameMetrics: () => exportFrameMetricsCsv(sessionStoreRef.current),
    exportEventMetrics: () => exportEventMetricsCsv(sessionStoreRef.current),
    exportSummary: () =>
      exportSessionSummary(
        sessionStoreRef.current.buildSummary(),
        sessionStoreRef.current,
      ),
    startCalibration,
    saveProfile,
    clearSessionData,
  };
}
