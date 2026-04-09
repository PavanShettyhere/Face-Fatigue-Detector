import type { Point2D } from "../types/domain";
import { clamp, distance, safeDivide } from "../utils/math";

export interface PupilEstimate {
  diameterPx: number | null;
  normalizedDiameter: number | null;
  confidence: number;
  center: Point2D | null;
}

export interface PupilEstimatorInput {
  context: CanvasRenderingContext2D;
  eyeOutline: Point2D[];
  irisCenter: Point2D;
  irisDiameterPx: number;
}

function boundingBox(points: Point2D[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function estimatePupilDiameter({
  context,
  eyeOutline,
  irisCenter,
  irisDiameterPx,
}: PupilEstimatorInput): PupilEstimate {
  if (irisDiameterPx < 4) {
    return {
      diameterPx: null,
      normalizedDiameter: null,
      confidence: 0,
      center: null,
    };
  }

  const box = boundingBox(eyeOutline);
  const padding = irisDiameterPx * 0.7;
  const x = Math.max(0, Math.floor(box.minX - padding));
  const y = Math.max(0, Math.floor(box.minY - padding));
  const width = Math.max(1, Math.ceil(box.maxX - box.minX + padding * 2));
  const height = Math.max(1, Math.ceil(box.maxY - box.minY + padding * 2));
  const image = context.getImageData(x, y, width, height);
  const center = {
    x: irisCenter.x - x,
    y: irisCenter.y - y,
  };

  const radius = irisDiameterPx / 2;
  const grayscale: number[] = [];
  for (let index = 0; index < image.data.length; index += 4) {
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    grayscale.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }

  const irisPixels: number[] = [];
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      if (distance({ x: px, y: py }, center) <= radius * 0.92) {
        irisPixels.push(grayscale[py * width + px]);
      }
    }
  }

  if (!irisPixels.length) {
    return {
      diameterPx: null,
      normalizedDiameter: null,
      confidence: 0,
      center: null,
    };
  }

  const sorted = [...irisPixels].sort((a, b) => a - b);
  const threshold = sorted[Math.max(0, Math.floor(sorted.length * 0.18) - 1)] ?? 0;

  let darkCount = 0;
  let sumX = 0;
  let sumY = 0;
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const index = py * width + px;
      const pixel = grayscale[index];
      const inside = distance({ x: px, y: py }, center) <= radius * 0.92;
      if (inside && pixel <= threshold) {
        darkCount += 1;
        sumX += px;
        sumY += py;
      }
    }
  }

  if (darkCount < 6) {
    return {
      diameterPx: null,
      normalizedDiameter: null,
      confidence: 0.1,
      center: null,
    };
  }

  const centroid = {
    x: sumX / darkCount,
    y: sumY / darkCount,
  };

  let variance = 0;
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const index = py * width + px;
      const pixel = grayscale[index];
      const inside = distance({ x: px, y: py }, center) <= radius * 0.92;
      if (inside && pixel <= threshold) {
        variance +=
          (px - centroid.x) * (px - centroid.x) +
          (py - centroid.y) * (py - centroid.y);
      }
    }
  }

  const equivalentRadius = Math.sqrt(darkCount / Math.PI);
  const diameterPx = equivalentRadius * 2;
  const centerOffset = distance(centroid, center);
  const darknessContrast = clamp(
    safeDivide(
      sorted[Math.floor(sorted.length * 0.6)] - threshold,
      65,
      0,
    ),
    0,
    1,
  );
  const shapeScore = clamp(1 - safeDivide(Math.sqrt(variance / darkCount), radius * 1.8, 1), 0, 1);
  const centerScore = clamp(1 - safeDivide(centerOffset, radius * 0.85, 1), 0, 1);
  const sizeScore = clamp(
    1 - Math.abs(safeDivide(diameterPx, irisDiameterPx, 0) - 0.42) / 0.42,
    0,
    1,
  );

  const confidence = clamp(
    darknessContrast * 0.4 + shapeScore * 0.2 + centerScore * 0.25 + sizeScore * 0.15,
    0,
    1,
  );

  if (diameterPx <= 1 || diameterPx >= irisDiameterPx * 0.96 || confidence < 0.08) {
    return {
      diameterPx: null,
      normalizedDiameter: null,
      confidence,
      center: null,
    };
  }

  return {
    diameterPx,
    normalizedDiameter: diameterPx / irisDiameterPx,
    confidence,
    center: {
      x: centroid.x + x,
      y: centroid.y + y,
    },
  };
}
