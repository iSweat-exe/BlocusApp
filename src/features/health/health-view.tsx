import { listHealthSnapshots, type HealthSnapshot } from "@/lib/data/health";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { collectHealth, recordReport, type HealthReport } from "./collect";
import { formatAge, formatBytes, formatMs, sparklinePoints } from "./format";
import { DB_QUOTA_BYTES, type HealthStatus } from "./score";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const STATUS: Record<HealthStatus, { label: string; color: string }> = {
  ok: { label: "Opérationnel", color: "text-success" },
  degraded: { label: "Dégradé", color: "text-warning" },
  down: { label: "Critique", color: "text-danger" },
};

const VERCEL_STATES: Record<string, string> = {
  READY: "En ligne",
  BUILDING: "Déploiement en cours",
  QUEUED: "En file d'attente",
  INITIALIZING: "Initialisation",
  CANCELED: "Annulé",
  ERROR: "En erreur",
};

/** A labelled figure inside a card. */
function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** Latency card: an unreachable service shows "Injoignable". */
function LatencyMetric({ label, ms }: { label: string; ms: number | null }) {
  return (
    <Metric
      label={label}
      value={ms === null ? "Injoignable" : formatMs(ms)}
      hint="Temps de réponse d'une requête minimale"
    />
  );
}

function vercelMetric(report: HealthReport, now: number) {
  const { vercel } = report;
  if (vercel.kind === "not_configured") {
    return (
      <Metric
        label="Vercel"
        value="Non configuré"
        hint="Ajoute VERCEL_API_TOKEN et VERCEL_PROJECT_ID (voir le runbook)"
      />
    );
  }
  if (vercel.kind === "unavailable") {
    return <Metric label="Vercel" value="Injoignable" hint="L'API Vercel ne répond pas" />;
  }
  return (
    <Metric
      label="Vercel"
      value={VERCEL_STATES[vercel.state] ?? vercel.state}
      hint={
        vercel.createdAt
          ? `Dernier déploiement de production, ${formatAge(vercel.createdAt, now)}`
          : "Dernier déploiement de production"
      }
    />
  );
}

/** Score of the history as a line chart, with a text alternative. */
function ScoreHistory({ snapshots }: { snapshots: HealthSnapshot[] }) {
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
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox="0 -8 300 80"
        role="img"
        aria-label={`Score de santé de ${snapshots.length} mesures, de ${first.score} à ${last.score}, minimum ${lowest}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="0" x2="300" y2="0" className="stroke-line" strokeWidth="1" />
        <line x1="0" y1="64" x2="300" y2="64" className="stroke-line" strokeWidth="1" />
        <polyline
          points={sparklinePoints(scores, 300, 64)}
          fill="none"
          className="stroke-accent"
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

  const now = Date.parse(report.at);
  const status = STATUS[report.status];
  const stats = report.stats;
  const used = stats ? stats.dbSizeBytes / DB_QUOTA_BYTES : null;
  const snapshots = history.ok ? history.value : [];

  return (
    <div className="flex flex-col gap-section">
      <section aria-labelledby="score-title" className="card flex flex-col items-center gap-1 p-6">
        <h3 id="score-title" className="text-sm text-muted">
          Score global
        </h3>
        <p className={`text-5xl font-bold tracking-tight ${status.color}`}>
          {report.score}
          <span className="text-xl text-faint"> / 100</span>
        </p>
        <p className={`text-sm font-medium ${status.color}`}>{status.label}</p>
        <p className="text-xs text-faint">Mesuré à {dateFormat.format(new Date(report.at))}</p>
      </section>

      <section aria-labelledby="services-title" className="flex flex-col gap-2">
        <h3 id="services-title" className="section-title">
          Services
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LatencyMetric label="Base de données" ms={report.dbMs} />
          <LatencyMetric label="Authentification" ms={report.authMs} />
          {vercelMetric(report, now)}
          <Metric
            label="Stockage"
            value={
              stats ? `${formatBytes(stats.dbSizeBytes)} / ${formatBytes(DB_QUOTA_BYTES)}` : "—"
            }
            hint={used === null ? "Illisible" : `${Math.round(used * 100)} % du quota gratuit`}
          />
        </div>
      </section>

      <section aria-labelledby="users-title" className="flex flex-col gap-2">
        <h3 id="users-title" className="section-title">
          Utilisateurs
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Inscrits" value={stats ? String(stats.usersTotal) : "—"} />
          <Metric
            label="Actifs"
            value={stats ? String(stats.usersActive) : "—"}
            hint="Session renouvelée ces 15 dernières minutes"
          />
        </div>
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <h3 id="history-title" className="section-title">
          Historique (30 jours)
        </h3>
        <div className="card p-4">
          <ScoreHistory snapshots={snapshots} />
        </div>
      </section>
    </div>
  );
}
