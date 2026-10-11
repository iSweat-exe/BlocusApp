import type { ActivityHour } from "@/lib/data/statistics";
import { busiestHours, type HourOfDay } from "./activity";
import { areaGeometry, barsPath, niceMax } from "./chart";
import { formatAverage, formatCount, formatDay, formatHour, type Share } from "./format";

/** Drawing box of the SVG charts. The SVG is stretched to the width of the card, so only strokes stay crisp. */
const WIDTH = 300;
const HEIGHT = 64;

/** Horizontal grid shared by the line and the bars: top, middle and baseline. */
function Grid() {
  return (
    <>
      <line x1="0" y1="0" x2={WIDTH} y2="0" className="stroke-line" strokeWidth="1" />
      <line
        x1="0"
        y1={HEIGHT / 2}
        x2={WIDTH}
        y2={HEIGHT / 2}
        className="stroke-line"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <line x1="0" y1={HEIGHT} x2={WIDTH} y2={HEIGHT} className="stroke-line" strokeWidth="1" />
    </>
  );
}

/** Start, scale and end of a series, under the chart. */
function Axis({ rows, max, unit }: { rows: readonly ActivityHour[]; max: number; unit: string }) {
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return null;
  const withDay = rows.length > 24;
  const label = (iso: string) => (withDay ? formatDay(iso) : formatHour(iso));
  return (
    <figcaption className="flex flex-col gap-0.5 text-xs text-faint">
      <span className="flex justify-between gap-2">
        <span>{label(first.hour)}</span>
        <span className="text-right">{label(last.hour)}</span>
      </span>
      <span className="text-center">
        Échelle : 0 à {formatCount(max)} {unit}
      </span>
    </figcaption>
  );
}

/**
 * Distinct active users per hour, as a line with a soft area under it. Hours before the activity was measured
 * are left blank (they are unknown, not zero). A dashed rule marks the busiest hour.
 */
export function ActivityChart({
  rows,
  peak,
}: {
  rows: readonly ActivityHour[];
  peak: { hour: string; value: number } | null;
}) {
  const max = niceMax(Math.max(0, ...rows.filter((row) => row.tracked).map((r) => r.activeUsers)));
  const geometry = areaGeometry(rows, WIDTH, HEIGHT, max);
  if (!geometry) return null;

  const peakIndex = peak ? rows.findIndex((row) => row.hour === peak.hour) : -1;
  const peakX = rows.length > 1 ? (peakIndex / (rows.length - 1)) * WIDTH : 0;
  const summary = peak
    ? `Utilisateurs actifs par heure sur ${rows.length} heures, pic de ${peak.value} le ${formatHour(peak.hour)}`
    : `Utilisateurs actifs par heure sur ${rows.length} heures`;

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 -4 ${WIDTH} ${HEIGHT + 8}`}
        role="img"
        aria-label={summary}
        className="h-36 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="stats-activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <Grid />
        {peak && peakIndex >= 0 && peak.value > 0 && (
          <line
            x1={peakX}
            y1="0"
            x2={peakX}
            y2={HEIGHT}
            className="stroke-accent"
            strokeWidth="1"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
        )}
        <polygon points={geometry.area} fill="url(#stats-activity-fill)" />
        <polyline
          points={geometry.line}
          fill="none"
          className="stroke-accent"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <Axis rows={rows} max={max} unit="utilisateurs" />
    </figure>
  );
}

/** Accounts created per hour, as bars (most hours are empty, which a line would not show well). */
export function SignupsChart({ rows, total }: { rows: readonly ActivityHour[]; total: number }) {
  const values = rows.map((row) => row.signups);
  const max = niceMax(Math.max(0, ...values));
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 -4 ${WIDTH} ${HEIGHT + 8}`}
        role="img"
        aria-label={`Inscriptions par heure sur ${rows.length} heures, ${total} au total`}
        className="h-28 w-full"
        preserveAspectRatio="none"
      >
        <Grid />
        <path d={barsPath(values, WIDTH, HEIGHT, max)} className="fill-accent" />
      </svg>
      <Axis rows={rows} max={max} unit="inscriptions" />
    </figure>
  );
}

/** Average active users at each hour of the day (Paris time): one column per hour, the busiest ones highlighted. */
export function HourOfDayChart({ profile }: { profile: readonly HourOfDay[] }) {
  const max = Math.max(0, ...profile.map((slot) => slot.average ?? 0));
  const busiest = new Set(busiestHours(profile).map((slot) => slot.hour));
  return (
    <figure className="flex flex-col gap-2">
      <div aria-hidden="true" className="flex h-28 items-end gap-0.5 border-b border-line">
        {profile.map((slot) => {
          const share = max > 0 && slot.average ? (slot.average / max) * 100 : 0;
          return (
            <div key={slot.hour} className="flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t-sm ${busiest.has(slot.hour) ? "bg-accent" : "bg-accent/35"}`}
                style={{ height: `${share}%`, minHeight: share > 0 ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <figcaption className="flex justify-between text-xs text-faint" aria-hidden="true">
        {[0, 6, 12, 18, 23].map((hour) => (
          <span key={hour}>{hour} h</span>
        ))}
      </figcaption>
      <ol className="sr-only">
        {profile.map((slot) => (
          <li key={slot.hour}>
            {slot.hour} h :{" "}
            {slot.average === null
              ? "aucune mesure"
              : `${formatAverage(slot.average)} utilisateurs en moyenne`}
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** A distribution as rows with a bar relative to the whole (the bar is decorative: the figures are in text). */
export function ShareList({
  shares,
  labelOf,
}: {
  shares: readonly Share[];
  labelOf: (key: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {shares.map((share) => (
        <li key={share.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{labelOf(share.key)}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {formatCount(share.total)} · {share.percent === 0 ? "< 1" : share.percent} %
            </span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, share.percent)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
