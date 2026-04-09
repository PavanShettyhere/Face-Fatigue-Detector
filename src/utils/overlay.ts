import type { FaceSignalSnapshot } from "../detection/landmarkAnalysis";
import type { EyeMetrics, LiveAnalysisState, Point2D } from "../types/domain";

function drawPolyline(
  context: CanvasRenderingContext2D,
  points: Point2D[],
  color: string,
  close = true,
): void {
  if (!points.length) {
    return;
  }
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  if (close) {
    context.closePath();
  }
  context.stroke();
  context.restore();
}

function drawPupil(
  context: CanvasRenderingContext2D,
  eye: EyeMetrics,
  irisCenter: Point2D,
  irisDiameterPx: number,
): void {
  context.save();
  context.strokeStyle = "rgba(114, 239, 221, 0.85)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(irisCenter.x, irisCenter.y, irisDiameterPx / 2, 0, Math.PI * 2);
  context.stroke();

  if (eye.pupilCenter && eye.pupilDiameterPx) {
    context.strokeStyle = eye.pupilConfidence > 0.45 ? "#ffbf69" : "#ff5d73";
    context.beginPath();
    context.arc(eye.pupilCenter.x, eye.pupilCenter.y, eye.pupilDiameterPx / 2, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = eye.pupilConfidence > 0.45 ? "#ffbf69" : "#ff5d73";
    context.beginPath();
    context.arc(eye.pupilCenter.x, eye.pupilCenter.y, 2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function drawAnalysisFrame(params: {
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  brightnessCompensation: number;
  contrastCompensation: number;
  signals: FaceSignalSnapshot | null;
  state: LiveAnalysisState;
}): void {
  const {
    context,
    canvas,
    video,
    brightnessCompensation,
    contrastCompensation,
    signals,
    state,
  } = params;

  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = `brightness(${100 + brightnessCompensation}%) contrast(${100 + contrastCompensation}%)`;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  if (signals) {
    if (signals.face.faceBox) {
      context.strokeStyle = state.confidenceScore > 0.45 ? "#7ae582" : "#ff5d73";
      context.lineWidth = 2;
      context.strokeRect(
        signals.face.faceBox.x,
        signals.face.faceBox.y,
        signals.face.faceBox.width,
        signals.face.faceBox.height,
      );
    }

    drawPolyline(context, signals.leftEye.eyeOutline, "#70e1f5");
    drawPolyline(context, signals.rightEye.eyeOutline, "#70e1f5");
    drawPolyline(context, signals.mouthContour, "#ff8fab");
    drawPupil(context, state.leftEye, signals.leftEye.irisCenter, signals.leftEye.irisDiameterPx);
    drawPupil(context, state.rightEye, signals.rightEye.irisCenter, signals.rightEye.irisDiameterPx);

    context.fillStyle = "rgba(255,255,255,0.78)";
    signals.faceLandmarks.forEach((point) => {
      context.fillRect(point.x, point.y, 1.5, 1.5);
    });
  } else {
    context.fillStyle = "rgba(20, 26, 38, 0.76)";
    context.fillRect(24, 24, 280, 72);
    context.fillStyle = "#f4f1de";
    context.font = "600 18px Space Grotesk, sans-serif";
    context.fillText("Face not confidently tracked", 42, 56);
    context.font = "14px Space Grotesk, sans-serif";
    context.fillText("Check lighting, framing, and glasses reflections.", 42, 78);
  }

  const labels = [
    `Tracking ${state.face.faceDetected ? "active" : "searching"}`,
    `Blink ${state.blinkState}`,
    `Yawn ${state.yawnState}`,
    `Confidence ${(state.confidenceScore * 100).toFixed(0)}%`,
  ];

  context.fillStyle = "rgba(9, 12, 18, 0.76)";
  context.fillRect(18, canvas.height - 98, 360, 78);
  context.fillStyle = "#f6fff8";
  context.font = "600 15px Space Grotesk, sans-serif";
  labels.forEach((label, index) => {
    context.fillText(label, 32, canvas.height - 66 + index * 17);
  });

  context.restore();
}

export function drawDemoFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: LiveAnalysisState,
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#08131d");
  gradient.addColorStop(1, "#16253d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(117, 214, 255, 0.12)";
  for (let x = 0; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const eyeClosure = state.perclos.combined * 0.8;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const eyeWidth = 120;
  const eyeHeight = 40 * (1 - eyeClosure);

  context.strokeStyle = "#70e1f5";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(centerX - 130, centerY - 40, eyeWidth / 2, Math.max(6, eyeHeight), 0, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.ellipse(centerX + 130, centerY - 40, eyeWidth / 2, Math.max(6, eyeHeight), 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#ffbf69";
  context.beginPath();
  context.arc(centerX - 130, centerY - 40, 14 * (1 - eyeClosure * 0.4), 0, Math.PI * 2);
  context.arc(centerX + 130, centerY - 40, 14 * (1 - eyeClosure * 0.4), 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ff8fab";
  context.beginPath();
  context.ellipse(centerX, centerY + 120, 110, 28 + state.mouthOpening * 90, 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#f4f1de";
  context.font = "600 28px Space Grotesk, sans-serif";
  context.fillText("Demo feed", 30, 50);
  context.font = "16px Space Grotesk, sans-serif";
  context.fillText("Synthetic analytics are driving the dashboard and charts.", 30, 80);
}
