import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

import { AppConfig } from "../types/domain";

let cachedLandmarker: FaceLandmarker | null = null;

async function resolveModelAssetPath(config: AppConfig): Promise<string> {
  const localPath = config.faceLandmarker.modelAssetPath;
  try {
    const response = await fetch(localPath, { method: "HEAD" });
    if (response.ok) {
      return localPath;
    }
  } catch {
    // Ignore and fall back to the hosted model path below.
  }

  return "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
}

export async function createFaceLandmarker(
  config: AppConfig,
): Promise<FaceLandmarker> {
  if (cachedLandmarker) {
    return cachedLandmarker;
  }

  const vision = await FilesetResolver.forVisionTasks(
    config.faceLandmarker.wasmRoot,
  );
  const modelAssetPath = await resolveModelAssetPath(config);

  cachedLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: config.faceLandmarker.minFaceDetectionConfidence,
    minFacePresenceConfidence: config.faceLandmarker.minFacePresenceConfidence,
    minTrackingConfidence: config.faceLandmarker.minTrackingConfidence,
  });

  return cachedLandmarker;
}

export function detectFaceForVideo(
  faceLandmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceLandmarkerResult {
  return faceLandmarker.detectForVideo(video, timestampMs);
}
