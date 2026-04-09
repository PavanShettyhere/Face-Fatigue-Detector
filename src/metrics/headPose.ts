import { clamp } from "../utils/math";

export function detectGazeInstability(offsets: Array<{ x: number; y: number }>): number {
  if (offsets.length < 2) {
    return 0;
  }

  const deltas = offsets.slice(1).map((offset, index) => {
    const previous = offsets[index];
    return Math.hypot(offset.x - previous.x, offset.y - previous.y);
  });

  const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  return clamp(mean / 0.18, 0, 1);
}
