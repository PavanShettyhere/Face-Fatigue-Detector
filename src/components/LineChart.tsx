import type { TimeSeriesPoint } from "../types/domain";

interface LineChartProps {
  title: string;
  subtitle: string;
  points: TimeSeriesPoint[];
  color: string;
  min?: number;
  max?: number;
}

function buildPath(points: TimeSeriesPoint[], width: number, height: number, min: number, max: number): string {
  if (points.length < 2) {
    return "";
  }
  const first = points[0].timestamp;
  const last = points[points.length - 1].timestamp;
  const span = Math.max(1, last - first);
  const range = Math.max(0.001, max - min);

  return points
    .filter((point) => point.value !== null)
    .map((point, index) => {
      const x = ((point.timestamp - first) / span) * width;
      const y = height - (((point.value ?? min) - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LineChart({
  title,
  subtitle,
  points,
  color,
  min = 0,
  max = 1,
}: LineChartProps) {
  const width = 360;
  const height = 120;
  const path = buildPath(points, width, height, min, max);
  const gradientId = `gradient-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-card__svg" role="img" aria-label={title}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {path ? (
          <>
            <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradientId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : null}
      </svg>
    </section>
  );
}
