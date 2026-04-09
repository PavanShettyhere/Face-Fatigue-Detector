import type { FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";

import {
  CHIN,
  FACE_OVAL,
  FOREHEAD,
  LEFT_CHEEK,
  LEFT_EYE_CORNERS,
  LEFT_EYE_OUTLINE,
  LEFT_EYE_RING,
  LEFT_IRIS,
  LOWER_LIP_CENTER,
  MOUTH_CORNERS,
  MOUTH_INNER,
  MOUTH_OUTER,
  NOSE_TIP,
  RIGHT_CHEEK,
  RIGHT_EYE_CORNERS,
  RIGHT_EYE_OUTLINE,
  RIGHT_EYE_RING,
  RIGHT_IRIS,
  UPPER_LIP_CENTER,
} from "../constants/landmarks";
import type { EyeMetrics, FaceTrackingMetrics, Point2D } from "../types/domain";
import { average, clamp, distance, midpoint, safeDivide, radiansToDegrees } from "../utils/math";

export interface EyeGeometry {
  eyeMetrics: Omit<
    EyeMetrics,
    "closurePercent" | "pupilDiameterPx" | "normalizedPupilDiameter" | "pupilConfidence" | "pupilCenter"
  >;
  eyeOutline: Point2D[];
  eyeCenter: Point2D;
  irisCenter: Point2D;
  irisDiameterPx: number;
}

export interface FaceSignalSnapshot {
  leftEye: EyeGeometry;
  rightEye: EyeGeometry;
  face: FaceTrackingMetrics;
  mouthOpening: number;
  mouthWidthPx: number;
  mouthContour: Point2D[];
  faceLandmarks: Point2D[];
}

function toPoint(
  landmark: NormalizedLandmark | undefined,
  width: number,
  height: number,
): Point2D {
  if (!landmark) {
    return {
      x: 0,
      y: 0,
    };
  }
  return {
    x: landmark.x * width,
    y: landmark.y * height,
  };
}

function getPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
): Point2D {
  return toPoint(landmarks[index], width, height);
}

function getPoints(
  landmarks: NormalizedLandmark[],
  indices: number[],
  width: number,
  height: number,
): Point2D[] {
  return indices
    .filter((index) => landmarks[index] !== undefined)
    .map((index) => getPoint(landmarks, index, width, height));
}

function boundingBox(points: Point2D[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function computeIrisDiameter(points: Point2D[]): number {
  const box = boundingBox(points);
  return average([box.width, box.height]) ?? 0;
}

function computeEyeGeometry(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  ring: number[],
  outline: number[],
  corners: number[],
  irisIndices: number[],
): EyeGeometry {
  const p1 = getPoint(landmarks, ring[0], width, height);
  const p2 = getPoint(landmarks, ring[1], width, height);
  const p3 = getPoint(landmarks, ring[2], width, height);
  const p4 = getPoint(landmarks, ring[3], width, height);
  const p5 = getPoint(landmarks, ring[4], width, height);
  const p6 = getPoint(landmarks, ring[5], width, height);
  const cornerStart = getPoint(landmarks, corners[0], width, height);
  const cornerEnd = getPoint(landmarks, corners[1], width, height);
  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const eyeWidth = distance(p1, p4);
  const opennessPx = (vertical1 + vertical2) / 2;
  const opennessRatio = safeDivide(vertical1 + vertical2, 2 * eyeWidth, 0);
  const eyeOutline = getPoints(landmarks, outline, width, height);
  const eyeCenter = midpoint(cornerStart, cornerEnd);
  const iris = getPoints(landmarks, irisIndices, width, height);
  const irisCenter =
    iris.length >= 3 ? midpoint(iris[0], iris[2]) : eyeCenter;
  const irisDiameterPx =
    iris.length >= 2 ? computeIrisDiameter(iris) : eyeWidth * 0.34;

  return {
    eyeMetrics: {
      opennessRatio,
      opennessPx,
      widthPx: eyeWidth,
      irisDiameterPx,
      gazeOffset: {
        x: safeDivide(irisCenter.x - eyeCenter.x, eyeWidth, 0),
        y: safeDivide(irisCenter.y - eyeCenter.y, opennessPx || 1, 0),
      },
    },
    eyeOutline,
    eyeCenter,
    irisCenter,
    irisDiameterPx,
  };
}

function rotationFromMatrix(matrix: number[]): { pitch: number; yaw: number; roll: number } {
  const r00 = matrix[0];
  const r10 = matrix[4];
  const r20 = matrix[8];
  const r21 = matrix[9];
  const r22 = matrix[10];

  const yaw = Math.atan2(r10, r00);
  const pitch = Math.atan2(-r20, Math.sqrt(r21 * r21 + r22 * r22));
  const roll = Math.atan2(r21, r22);

  return {
    pitch: radiansToDegrees(pitch),
    yaw: radiansToDegrees(yaw),
    roll: radiansToDegrees(roll),
  };
}

export function computeFaceSignals(
  result: FaceLandmarkerResult,
  width: number,
  height: number,
): FaceSignalSnapshot | null {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) {
    return null;
  }

  const faceContour = getPoints(landmarks, FACE_OVAL, width, height);
  const faceBox = boundingBox(faceContour);

  const leftEye = computeEyeGeometry(
    landmarks,
    width,
    height,
    LEFT_EYE_RING,
    LEFT_EYE_OUTLINE,
    LEFT_EYE_CORNERS,
    LEFT_IRIS,
  );
  const rightEye = computeEyeGeometry(
    landmarks,
    width,
    height,
    RIGHT_EYE_RING,
    RIGHT_EYE_OUTLINE,
    RIGHT_EYE_CORNERS,
    RIGHT_IRIS,
  );

  const upperLip = getPoint(landmarks, UPPER_LIP_CENTER, width, height);
  const lowerLip = getPoint(landmarks, LOWER_LIP_CENTER, width, height);
  const mouthCorners = getPoints(landmarks, MOUTH_CORNERS, width, height);
  const mouthWidthPx = distance(mouthCorners[0], mouthCorners[1]);
  const mouthOpening = clamp(
    safeDivide(distance(upperLip, lowerLip), mouthWidthPx, 0),
    0,
    1.5,
  );

  const faceVisibilityConfidence = clamp(
    safeDivide(faceBox.width * faceBox.height, width * height * 0.28, 0),
    0,
    1,
  );

  const cheekDistance = distance(
    getPoint(landmarks, LEFT_CHEEK, width, height),
    getPoint(landmarks, RIGHT_CHEEK, width, height),
  );

  const transform = result.facialTransformationMatrixes?.[0]?.data;
  const headPose = transform
    ? rotationFromMatrix(Array.from(transform))
    : {
        pitch: safeDivide(
          getPoint(landmarks, CHIN, width, height).y -
            getPoint(landmarks, FOREHEAD, width, height).y,
          faceBox.height || 1,
          0,
        ) * 48 -
          24,
        yaw: safeDivide(
          getPoint(landmarks, NOSE_TIP, width, height).x -
            midpoint(
              getPoint(landmarks, LEFT_CHEEK, width, height),
              getPoint(landmarks, RIGHT_CHEEK, width, height),
            ).x,
          faceBox.width || 1,
          0,
        ) * 90,
        roll: 0,
      };

  return {
    leftEye,
    rightEye,
    face: {
      faceDetected: true,
      faceConfidence: 1,
      trackingConfidence: 1,
      faceBox,
      headPose,
      faceDistanceEstimate: clamp(cheekDistance / width, 0, 1),
      motionBlurScore: 0,
      occlusionScore: 0,
      faceVisibilityConfidence,
    },
    mouthOpening,
    mouthWidthPx,
    mouthContour: getPoints(landmarks, MOUTH_OUTER, width, height),
    faceLandmarks: getPoints(landmarks, [...FACE_OVAL, ...MOUTH_INNER], width, height),
  };
}
