import type { AlertRecord } from "../types/domain";

interface AlertStackProps {
  alerts: AlertRecord[];
}

export function AlertStack({ alerts }: AlertStackProps) {
  if (!alerts.length) {
    return null;
  }

  return (
    <div className="alert-stack">
      {alerts.slice(0, 4).map((alert) => (
        <article key={alert.id} className={`alert-chip alert-chip--${alert.level}`}>
          <strong>{alert.title}</strong>
          <p>{alert.message}</p>
        </article>
      ))}
    </div>
  );
}
