import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

import { AppConfig } from "../types/domain";

let cachedLandmarker: FaceLandmarker | null = null;

const DEFAULT_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

async function loadLocalModelBuffer(
  localPath: string,
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(localPath, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 4));
    const looksLikeZipArchive =
      bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;

    if (!looksLikeZipArchive) {
      return null;
    }

    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

async function resolveModelSource(
  config: AppConfig,
): Promise<{ modelAssetBuffer?: Uint8Array; modelAssetPath?: string }> {
  const localPath = config.faceLandmarker.modelAssetPath;
  const localBuffer = await loadLocalModelBuffer(localPath);
  if (localBuffer) {
    return {
      modelAssetBuffer: localBuffer,
    };
  }

  return {
    modelAssetPath: DEFAULT_MODEL_ASSET_PATH,
  };
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
  const modelSource = await resolveModelSource(config);

  cachedLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: modelSource,
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
