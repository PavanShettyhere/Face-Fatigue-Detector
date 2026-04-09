import type { BlinkEvent, ClosureEvent, NodEvent, YawnEvent } from "../types/domain";

interface EventTimelineProps {
  blinks: BlinkEvent[];
  yawns: YawnEvent[];
  closures: ClosureEvent[];
  nods: NodEvent[];
}

export function EventTimeline({
  blinks,
  yawns,
  closures,
  nods,
}: EventTimelineProps) {
  const items = [
    ...blinks.slice(-6).map((event) => ({
      id: event.eventId,
      label: "Blink",
      meta: `${event.duration.toFixed(0)} ms`,
    })),
    ...yawns.slice(-4).map((event) => ({
      id: event.eventId,
      label: "Yawn",
      meta: `${(event.duration / 1000).toFixed(1)} s`,
    })),
    ...closures.slice(-4).map((event) => ({
      id: event.eventId,
      label: "Closure",
      meta: `${(event.duration / 1000).toFixed(1)} s`,
    })),
    ...nods.slice(-4).map((event) => ({
      id: event.eventId,
      label: "Nod",
      meta: `${event.pitchAmplitude.toFixed(1)} deg`,
    })),
  ].slice(-12);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Event Timeline</h2>
          <p>Recent blink, yawn, closure, and nod detections.</p>
        </div>
      </div>
      <div className="timeline">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="timeline__item">
              <strong>{item.label}</strong>
              <span>{item.meta}</span>
            </article>
          ))
        ) : (
          <p className="timeline__empty">No completed events yet.</p>
        )}
      </div>
    </section>
  );
}
