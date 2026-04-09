import { Point2D } from "../types/domain";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

export function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  if (!filtered.length) {
    return null;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function stdDev(values: Array<number | null | undefined>): number {
  const filtered = values.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  if (filtered.length < 2) {
    return 0;
  }
  const mean = filtered.reduce((acc, value) => acc + value, 0) / filtered.length;
  const variance = filtered.reduce((acc, value) => acc + (value - mean) ** 2, 0) / filtered.length;
  return Math.sqrt(variance);
}

export function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function smoothValue(previous: number | null, next: number, alpha: number): number {
  if (previous === null || Number.isNaN(previous)) {
    return next;
  }
  return lerp(previous, next, clamp(alpha, 0, 1));
}

export function percentile(values: number[], ratio: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * ratio), 0, sorted.length - 1);
  return sorted[index];
}

export function angleFromMatrix(matrix: number[], row: number, col: number): number {
  return matrix[row * 4 + col] ?? 0;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function safeDivide(value: number, divisor: number, fallback = 0): number {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) {
    return fallback;
  }
  return value / divisor;
}

export function round(value: number | null, digits = 2): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
