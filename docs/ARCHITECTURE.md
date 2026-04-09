# Architecture Summary

## Overview

The app is a privacy-first browser application built with React + TypeScript. Webcam capture happens in the browser, MediaPipe Face Landmarker runs locally in the client, and all metrics, events, exports, and summaries remain local unless the user explicitly shares the output files.

## Pipeline

1. Acquire webcam frames from `MediaDevices.getUserMedia()`.
2. Run MediaPipe Face Landmarker in `VIDEO` mode on the current frame.
3. Convert landmarks into eye openness, mouth opening, head pose, face box, and gaze offsets.
4. Estimate left and right pupil diameter inside eye ROIs using thresholded dark-pixel segmentation.
5. Feed smoothed signals into blink, yawn, prolonged-closure, and head-nod state machines.
6. Update rolling PERCLOS and fatigue metrics.
7. Draw the processed frame and overlays on a canvas.
8. Log frame-level metrics plus event-level records into the session store.
9. Render dashboard cards, charts, alerts, and session summary.
10. Export CSV, JSON, snapshots, and overlay recordings on demand.

## Main Modules

- `src/detection/`: MediaPipe bootstrapping, landmark analysis, and pupil estimation.
- `src/events/`: Explicit temporal state machines for blink, yawn, prolonged closure, and nodding.
- `src/metrics/`: PERCLOS tracking, fatigue index, gaze instability, and frame-quality metrics.
- `src/storage/`: Session logging plus CSV/JSON export helpers.
- `src/hooks/useAnalysisSession.ts`: Real-time orchestration loop and UI-facing session state.
- `src/components/`: Dashboard UI panels, controls, charts, timeline, and summary.

## Core Formulas

- Eye openness ratio: average eyelid gap divided by eye width.
- Eye closure percentage: `1 - openness / calibrated_open_openness`, clamped to `[0, 1]`.
- Blink duration: `blink_end - blink_start`.
- Blink closing duration: `peak_closure_time - blink_start`.
- Blink reopening duration: `blink_end - reopening_start`.
- Reopening delay: `reopening_start - peak_closure_time`.
- Blink speed: `closure_depth / phase_duration`.
- PERCLOS: percentage of time in a rolling window where closure exceeds the configured threshold.
- Pupil variability: rolling standard deviation of accepted pupil diameter samples.
- Fatigue index: weighted sum of PERCLOS, prolonged closures, slow reopenings, yawns, gaze instability, nodding, and blink-rate deviation.

## Local Privacy Behavior

- Webcam access is permission-gated by the browser.
- The default flow keeps computation in the client.
- Exports are user-triggered only.
- Session data can be cleared with one click.
