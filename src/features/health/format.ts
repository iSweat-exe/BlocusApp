const MB = 1024 * 1024;

/** `12,3 Mo`, `1,2 Go`: size of the database, in French. */
export function formatBytes(bytes: number): string {
  const format = (value: number) => value.toFixed(1).replace(".", ",");
  return bytes >= 1024 * MB ? `${format(bytes / (1024 * MB))} Go` : `${format(bytes / MB)} Mo`;
}

/** `85 ms`, `1,2 s`; `—` when the measure could not be taken. */
export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${ms} ms`;
}

/** Age of a date in French (`à l'instant`, `il y a 5 min`, `il y a 3 h`, `il y a 2 j`). */
export function formatAge(from: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - from) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 60 * 24) return `il y a ${Math.floor(minutes / 60)} h`;
  return `il y a ${Math.floor(minutes / (60 * 24))} j`;
}

/**
 * Points of a polyline for a score history (values 0 to 100, oldest first) in a `width` x `height` box, with
 * 100 at the top. One value is drawn as a flat line; no value gives an empty string.
 */
export function sparklinePoints(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const y = height - (Math.min(100, Math.max(0, value)) / 100) * height;
      return `${Math.round(index * step * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}
