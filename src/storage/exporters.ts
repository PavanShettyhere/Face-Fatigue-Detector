import type { SessionSummary } from "../types/domain";
import { toCsv, triggerDownload } from "../utils/csv";
import { SessionStore } from "./sessionStore";

export function exportFrameMetricsCsv(sessionStore: SessionStore): void {
  triggerDownload(
    `frame-metrics-${Date.now()}.csv`,
    toCsv(sessionStore.frames),
    "text/csv;charset=utf-8",
  );
}

export function exportEventMetricsCsv(sessionStore: SessionStore): void {
  const rows = [
    ...sessionStore.blinkEvents.map((event) => ({ type: "blink", ...event })),
    ...sessionStore.yawnEvents.map((event) => ({ type: "yawn", ...event })),
    ...sessionStore.closureEvents.map((event) => ({ type: "closure", ...event })),
    ...sessionStore.nodEvents.map((event) => ({ type: "nod", ...event })),
  ];

  triggerDownload(
    `event-metrics-${Date.now()}.csv`,
    toCsv(rows),
    "text/csv;charset=utf-8",
  );
}

export function exportSessionSummary(summary: SessionSummary, sessionStore: SessionStore): void {
  triggerDownload(
    `session-summary-${Date.now()}.json`,
    JSON.stringify(
      {
        summary,
        alerts: sessionStore.alerts,
      },
      null,
      2,
    ),
    "application/json;charset=utf-8",
  );
}
