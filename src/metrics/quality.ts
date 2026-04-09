import type { FaceTrackingMetrics } from "../types/domain";
import { clamp, safeDivide } from "../utils/math";

function variance(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function computeLightingAndBlur(
  context: CanvasRenderingContext2D,
  faceBox: FaceTrackingMetrics["faceBox"],
): {
  lightingScore: number;
  blurScore: number;
  occlusionScore: number;
} {
  if (!faceBox) {
    return {
      lightingScore: 0,
      blurScore: 1,
      occlusionScore: 1,
    };
  }

  const x = Math.max(0, Math.floor(faceBox.x));
  const y = Math.max(0, Math.floor(faceBox.y));
  const width = Math.max(1, Math.floor(faceBox.width));
  const height = Math.max(1, Math.floor(faceBox.height));
  const image = context.getImageData(x, y, width, height);
  const luma: number[] = [];

  for (let index = 0; index < image.data.length; index += 4) {
    const brightness =
      0.2126 * image.data[index] +
      0.7152 * image.data[index + 1] +
      0.0722 * image.data[index + 2];
    luma.push(brightness);
  }

  const mean = luma.reduce((sum, value) => sum + value, 0) / Math.max(1, luma.length);
  const contrast = Math.sqrt(variance(luma));
  const lightingBalance = 1 - Math.abs(mean - 128) / 128;
  const lightingScore = clamp(lightingBalance * 0.7 + safeDivide(contrast, 64, 0) * 0.3, 0, 1);

  let edges = 0;
  let transitions = 0;
  for (let row = 1; row < height - 1; row += 2) {
    for (let col = 1; col < width - 1; col += 2) {
      const center = luma[row * width + col];
      const laplacian =
        4 * center -
        luma[(row - 1) * width + col] -
        luma[(row + 1) * width + col] -
        luma[row * width + (col - 1)] -
        luma[row * width + (col + 1)];
      edges += Math.abs(laplacian);
      transitions += 1;
    }
  }

  const blurScore = clamp(1 - safeDivide(edges / Math.max(1, transitions), 42, 0), 0, 1);
  const occlusionScore = clamp(
    safeDivide(luma.filter((value) => value < 20 || value > 235).length, luma.length, 0),
    0,
    1,
  );

  return {
    lightingScore,
    blurScore,
    occlusionScore,
  };
}
