import type { FatigueWeights } from "../types/domain";
import { clamp } from "../utils/math";

export interface FatigueInputs {
  perclos: number;
  prolongedClosureRate: number;
  slowReopeningRate: number;
  yawnRate: number;
  gazeInstability: number;
  noddingRate: number;
  blinkRateDeviation: number;
}

export function computeFatigueIndex(
  inputs: FatigueInputs,
  weights: FatigueWeights,
): number {
  const total =
    inputs.perclos * weights.perclos +
    inputs.prolongedClosureRate * weights.prolongedClosures +
    inputs.slowReopeningRate * weights.slowReopenings +
    inputs.yawnRate * weights.yawnRate +
    inputs.gazeInstability * weights.gazeInstability +
    inputs.noddingRate * weights.nodding +
    inputs.blinkRateDeviation * weights.blinkRateDeviation;

  return clamp(total, 0, 1);
}
