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

/** Daily cron: green while it ran in the last 36 hours, the keep-alive prevents Supabase from pausing the project. */
function cronMetric(report: HealthReport, now: number) {
  const last = report.details.trends?.lastCronAt;
  if (!last) {
    return (
      <Metric
        label="Tâche quotidienne"
        value="Jamais exécutée"
        hint="Aucun passage enregistré (cron ou clé service manquants ?)"
      />
    );
  }
  const late = (report.cronAgeHours ?? 0) > 36;
  return (
    <Metric
      label="Tâche quotidienne"
      value={late ? "En retard" : "À jour"}
      hint={`Dernier passage ${formatAge(Date.parse(last), now)}${late ? " : le projet gratuit risque la mise en pause" : ""}`}
    />
  );
}

/** Heaviest tables, with their share of the database quota. */
function TableSizes({ tables }: { tables: { name: string; bytes: number }[] }) {
  return (
    <ul className="card divide-y divide-line">
      {tables.map((table) => (
        <li key={table.name} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <code className="min-w-0 truncate font-mono text-xs">{table.name}</code>
          <span className="shrink-0 text-muted">{formatBytes(table.bytes)}</span>
        </li>
      ))}
    </ul>
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
  const { trends, tables, connections } = report.details;
  const availability =
    trends && trends.snapshots7d > 0
      ? Math.round((trends.up7d / trends.snapshots7d) * 1000) / 10
      : null;

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
          {cronMetric(report, now)}
          <Metric
            label="Connexions à la base"
            value={connections ? `${connections.open} / ${connections.max}` : "—"}
            hint={
              connections
                ? `${Math.round((connections.open / connections.max) * 100)} % de la limite du serveur`
                : "Illisible"
            }
          />
          <Metric
            label="Stockage"
            value={
              stats ? `${formatBytes(stats.dbSizeBytes)} / ${formatBytes(DB_QUOTA_BYTES)}` : "—"
            }
            hint={used === null ? "Illisible" : `${Math.round(used * 100)} % du quota gratuit`}
          />
        </div>
      </section>

      {tables && tables.length > 0 && (
        <section aria-labelledby="tables-title" className="flex flex-col gap-2">
          <h3 id="tables-title" className="section-title">
            Tables les plus lourdes
          </h3>
          <TableSizes tables={tables} />
        </section>
      )}

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
          Historique et tendance
        </h3>
        <div className="card p-4">
          <ScoreHistory snapshots={snapshots} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            label="Disponibilité (7 j)"
            value={availability === null ? "—" : `${String(availability).replace(".", ",")} %`}
            hint={
              trends
                ? `${trends.snapshots7d} mesures, score minimum ${trends.minScore7d ?? "—"}`
                : "Illisible"
            }
          />
          <Metric
            label="Base, p95 (24 h)"
            value={formatMs(trends?.p95Db24h ?? null)}
            hint="95 % des mesures sont plus rapides"
          />
          <Metric label="Base, p95 (7 j)" value={formatMs(trends?.p95Db7d ?? null)} />
        </div>
      </section>

      <section aria-labelledby="config-title" className="flex flex-col gap-2">
        <h3 id="config-title" className="section-title">
          Configuration
        </h3>
        <ul className="card divide-y divide-line">
          {report.config.map((check) => (
            <li key={check.key} className="flex flex-col gap-0.5 px-4 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>{check.label}</span>
                <span
                  className={
                    check.ok ? "text-success" : check.required ? "text-danger" : "text-warning"
                  }
                >
                  {check.ok ? "Configuré" : check.required ? "Manquant" : "Non configuré"}
                </span>
              </div>
              {!check.ok && <p className="text-xs text-faint">{check.hint}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
