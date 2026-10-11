import type { ReactNode } from "react";
import { listHealthSnapshots, type HealthSnapshot } from "@/lib/data/health";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { collectHealth, recordReport, type HealthReport } from "./collect";
import { formatAge, formatBytes, formatMs, sparklinePoints } from "./format";
import {
  availabilityTone,
  configTone,
  connectionsTone,
  cronTone,
  latencyTone,
  storageTone,
  TONE_WORDS,
  vercelTone,
  type Tone,
} from "./health-tones";
import { DB_QUOTA_BYTES, THRESHOLDS, type HealthStatus } from "./score";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Colors of each state: the dot of a row, the ring and the chip of the score, the bar of a ratio. */
const TONE_STYLE: Record<
  Tone,
  { dot: string; text: string; stroke: string; chip: string; bar: string; color: string }
> = {
  ok: {
    dot: "bg-success",
    text: "text-success",
    stroke: "stroke-success",
    chip: "bg-success/15 text-success",
    bar: "bg-success",
    color: "var(--success)",
  },
  degraded: {
    dot: "bg-warning",
    text: "text-warning",
    stroke: "stroke-warning",
    chip: "bg-warning/15 text-warning",
    bar: "bg-warning",
    color: "var(--warning)",
  },
  down: {
    dot: "bg-danger",
    text: "text-danger",
    stroke: "stroke-danger",
    chip: "bg-danger/15 text-danger",
    bar: "bg-danger",
    color: "var(--danger)",
  },
  neutral: {
    dot: "bg-foreground/25",
    text: "text-muted",
    stroke: "stroke-foreground/25",
    chip: "bg-foreground/10 text-muted",
    bar: "bg-foreground/25",
    color: "var(--foreground)",
  },
};

const STATUS: Record<HealthStatus, { label: string; tone: Tone }> = {
  ok: { label: "Opérationnel", tone: "ok" },
  degraded: { label: "Dégradé", tone: "degraded" },
  down: { label: "Critique", tone: "down" },
};

const VERCEL_STATES: Record<string, string> = {
  READY: "En ligne",
  BUILDING: "Déploiement en cours",
  QUEUED: "En file d'attente",
  INITIALIZING: "Initialisation",
  CANCELED: "Annulé",
  ERROR: "En erreur",
};

/** A service as a row: its state as a colored dot (and in words for assistive technologies), then its value. */
function ServiceRow({
  label,
  value,
  hint,
  tone,
  ratio,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: Tone;
  /** Share of a limit already used, from 0 to 1: drawn as a thin bar under the text. */
  ratio?: number | null;
}) {
  const style = TONE_STYLE[tone];
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${style.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
        {ratio != null && (
          <div
            aria-hidden="true"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10"
          >
            <div
              className={`h-full rounded-full ${style.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, Math.round(ratio * 100)))}%` }}
            />
          </div>
        )}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">
        {value}
        <span className="sr-only"> ({TONE_WORDS[tone]})</span>
      </p>
    </li>
  );
}

/** A big figure: the kind of number one looks at first. */
function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`font-display text-3xl font-extrabold tracking-tight tabular-nums ${
          tone ? TONE_STYLE[tone].text : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** Title of a group of the page, with an optional count on the right. */
function GroupTitle({ id, children, count }: { id: string; children: ReactNode; count?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 id={id} className="section-title">
        {children}
      </h3>
      {count && <span className="px-1 text-xs tabular-nums text-faint">{count}</span>}
    </div>
  );
}

/** Score as a ring that fills with it, in the color of the state. Decorative: the figure beside it says it. */
function ScoreRing({ score, tone }: { score: number; tone: Tone }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className="size-36 shrink-0 -rotate-90">
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        strokeWidth="10"
        className="stroke-foreground/10"
      />
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        className={TONE_STYLE[tone].stroke}
      />
    </svg>
  );
}

/** Heaviest tables, each with a bar relative to the heaviest one. */
function TableSizes({ tables }: { tables: { name: string; bytes: number }[] }) {
  const heaviest = Math.max(1, ...tables.map((table) => table.bytes));
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {tables.map((table) => (
        <li key={table.name} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <code className="min-w-0 truncate font-mono text-xs">{table.name}</code>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatBytes(table.bytes)}
            </span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-foreground/35"
              style={{ width: `${Math.max(2, Math.round((table.bytes / heaviest) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Score of the history as a line chart with a soft area under it, with a text alternative. */
function ScoreHistory({ snapshots, tone }: { snapshots: HealthSnapshot[]; tone: Tone }) {
  if (snapshots.length < 2) {
    return (
      <p className="text-sm text-muted">
        L&apos;historique se construit à chaque visite de cette page et chaque nuit (cron).
      </p>
    );
  }
  const scores = snapshots.map((snapshot) => snapshot.score);
  const lowest = Math.min(...scores);
  const first = snapshots[0]!;
  const last = snapshots.at(-1)!;
  const line = sparklinePoints(scores, 300, 64);
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox="0 -8 300 80"
        role="img"
        aria-label={`Score de santé de ${snapshots.length} mesures, de ${first.score} à ${last.score}, minimum ${lowest}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="health-score-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: TONE_STYLE[tone].color, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: TONE_STYLE[tone].color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <line x1="0" y1="0" x2="300" y2="0" className="stroke-line" strokeWidth="1" />
        <line
          x1="0"
          y1="32"
          x2="300"
          y2="32"
          className="stroke-line"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <line x1="0" y1="64" x2="300" y2="64" className="stroke-line" strokeWidth="1" />
        <polygon points={`${line} 300,64 0,64`} fill="url(#health-score-fill)" />
        <polyline
          points={line}
          fill="none"
          className={TONE_STYLE[tone].stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex justify-between text-xs text-faint">
        <span>{dateFormat.format(new Date(first.created_at))}</span>
        <span>Score minimum : {lowest}</span>
        <span>{dateFormat.format(new Date(last.created_at))}</span>
      </figcaption>
    </figure>
  );
}

/** Daily cron: green while it ran in the last 36 hours, the keep-alive prevents Supabase from pausing the project. */
function cronRow(report: HealthReport, now: number) {
  const last = report.details.trends?.lastCronAt;
  if (!last) {
    return (
      <ServiceRow
        label="Tâche quotidienne"
        value="Jamais exécutée"
        hint="Aucun passage enregistré (cron ou clé service manquants ?)"
        tone={cronTone(null)}
      />
    );
  }
  const late = (report.cronAgeHours ?? 0) > THRESHOLDS.cronHours.good;
  return (
    <ServiceRow
      label="Tâche quotidienne"
      value={late ? "En retard" : "À jour"}
      hint={`Dernier passage ${formatAge(Date.parse(last), now)}${late ? " : le projet gratuit risque la mise en pause" : ""}`}
      tone={cronTone(report.cronAgeHours)}
    />
  );
}

function vercelRow(report: HealthReport, now: number) {
  const { vercel } = report;
  const tone = vercelTone(vercel);
  if (vercel.kind === "not_configured") {
    return (
      <ServiceRow
        label="Vercel"
        value="Non configuré"
        hint="Ajoute VERCEL_API_TOKEN et VERCEL_PROJECT_ID (voir le runbook)"
        tone={tone}
      />
    );
  }
  if (vercel.kind === "unavailable") {
    return (
      <ServiceRow
        label="Vercel"
        value="Injoignable"
        hint="L'API Vercel ne répond pas"
        tone={tone}
      />
    );
  }
  return (
    <ServiceRow
      label="Vercel"
      value={VERCEL_STATES[vercel.state] ?? vercel.state}
      hint={
        vercel.createdAt
          ? `Dernier déploiement de production, ${formatAge(vercel.createdAt, now)}`
          : "Dernier déploiement de production"
      }
      tone={tone}
    />
  );
}

/** The page, from a measurement and the history: pure, so it renders the same with any data. */
export function HealthDashboard({
  report,
  snapshots,
}: {
  report: HealthReport;
  snapshots: HealthSnapshot[];
}) {
  const now = Date.parse(report.at);
  const status = STATUS[report.status];
  const style = TONE_STYLE[status.tone];
  const stats = report.stats;
  const used = stats ? stats.dbSizeBytes / DB_QUOTA_BYTES : null;
  const { trends, tables, connections } = report.details;
  const availability =
    trends && trends.snapshots7d > 0
      ? Math.round((trends.up7d / trends.snapshots7d) * 1000) / 10
      : null;
  const configured = report.config.filter((check) => check.ok).length;

  return (
    <div className="flex flex-col gap-section">
      <section
        aria-labelledby="score-title"
        className="card flex flex-col items-center gap-4 p-6 sm:flex-row sm:gap-6"
      >
        <div className="relative shrink-0">
          <ScoreRing score={report.score} tone={status.tone} />
          <p
            className={`absolute inset-0 flex flex-col items-center justify-center font-display ${style.text}`}
          >
            <span className="text-5xl leading-none font-extrabold tracking-tight tabular-nums">
              {report.score}
            </span>
            <span className="text-xs font-semibold text-faint">sur 100</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
          <h3 id="score-title" className="text-sm font-medium text-muted">
            Score global
          </h3>
          <span className={`chip gap-2 text-sm ${style.chip}`}>
            <span aria-hidden="true" className={`size-2 rounded-full ${style.dot}`} />
            {status.label}
          </span>
          <p className="text-xs text-faint">Mesuré à {dateFormat.format(new Date(report.at))}</p>
        </div>
      </section>

      <section aria-labelledby="services-title" className="flex flex-col gap-2">
        <GroupTitle id="services-title">Services</GroupTitle>
        <ul className="card divide-y divide-line overflow-hidden">
          <ServiceRow
            label="Base de données"
            value={report.dbMs === null ? "Injoignable" : formatMs(report.dbMs)}
            hint="Temps de réponse d'une requête minimale"
            tone={latencyTone(report.dbMs, THRESHOLDS.dbMs)}
          />
          <ServiceRow
            label="Authentification"
            value={report.authMs === null ? "Injoignable" : formatMs(report.authMs)}
            hint="Temps de réponse d'une requête minimale"
            tone={latencyTone(report.authMs, THRESHOLDS.authMs)}
          />
          {vercelRow(report, now)}
          {cronRow(report, now)}
          <ServiceRow
            label="Connexions à la base"
            value={connections ? `${connections.open} / ${connections.max}` : "—"}
            hint={
              connections
                ? `${Math.round((connections.open / connections.max) * 100)} % de la limite du serveur`
                : "Illisible"
            }
            tone={connectionsTone(connections)}
            ratio={connections && connections.max > 0 ? connections.open / connections.max : null}
          />
          <ServiceRow
            label="Stockage"
            value={
              stats ? `${formatBytes(stats.dbSizeBytes)} / ${formatBytes(DB_QUOTA_BYTES)}` : "—"
            }
            hint={used === null ? "Illisible" : `${Math.round(used * 100)} % du quota gratuit`}
            tone={storageTone(stats ? stats.dbSizeBytes : null)}
            ratio={used}
          />
        </ul>
      </section>

      {tables && tables.length > 0 && (
        <section aria-labelledby="tables-title" className="flex flex-col gap-2">
          <GroupTitle id="tables-title">Tables les plus lourdes</GroupTitle>
          <TableSizes tables={tables} />
        </section>
      )}

      <section aria-labelledby="users-title" className="flex flex-col gap-2">
        <GroupTitle id="users-title">Utilisateurs</GroupTitle>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Inscrits" value={stats ? String(stats.usersTotal) : "—"} />
          <Stat
            label="Actifs"
            value={stats ? String(stats.usersActive) : "—"}
            hint="Session renouvelée ces 15 dernières minutes"
          />
        </div>
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <GroupTitle id="history-title">Historique et tendance</GroupTitle>
        <div className="card p-4">
          <ScoreHistory snapshots={snapshots} tone={status.tone} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Disponibilité (7 j)"
            value={availability === null ? "—" : `${String(availability).replace(".", ",")} %`}
            hint={
              trends
                ? `${trends.snapshots7d} mesures, score minimum ${trends.minScore7d ?? "—"}`
                : "Illisible"
            }
            tone={availabilityTone(availability)}
          />
          <Stat
            label="Base, p95 (24 h)"
            value={formatMs(trends?.p95Db24h ?? null)}
            hint="95 % des mesures sont plus rapides"
          />
          <Stat label="Base, p95 (7 j)" value={formatMs(trends?.p95Db7d ?? null)} />
        </div>
      </section>

      <section aria-labelledby="config-title" className="flex flex-col gap-2">
        <GroupTitle id="config-title" count={`${configured}/${report.config.length}`}>
          Configuration
        </GroupTitle>
        <ul className="card divide-y divide-line overflow-hidden">
          {report.config.map((check) => {
            const tone = configTone(check);
            return (
              <li key={check.key} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{check.label}</span>
                  <span className={`chip shrink-0 text-xs ${TONE_STYLE[tone].chip}`}>
                    {check.ok ? "Configuré" : check.required ? "Manquant" : "Non configuré"}
                  </span>
                </div>
                {!check.ok && <p className="text-xs text-muted">{check.hint}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * Health of the back end: global score, database, Auth, Vercel, storage, users, and the history of the score.
 * Measures on every render and stores a snapshot (the database keeps at most one every 10 minutes).
 * The caller must have checked `monitoring.view`; the database functions check it again.
 */
export async function HealthView() {
  const client = createClient(await requestCookies());
  const report = await collectHealth(client);
  await recordReport(client, report, "page");
  const history = await listHealthSnapshots(client);

  return <HealthDashboard report={report} snapshots={history.ok ? history.value : []} />;
}
