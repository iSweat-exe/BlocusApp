import type { ReactNode } from "react";
import { ChipTabs } from "@/components/chip-tabs";
import { countryFlag, countryName } from "@/lib/country";
import type { ActivityHour, StatsBreakdown, StatsOverview } from "@/lib/data/statistics";
import type { Role } from "@/lib/data/profiles";
import type { Result } from "@/lib/result";
import {
  busiestHours,
  hourOfDayProfile,
  lastHours,
  summarizeActivity,
  summarizeSignups,
} from "./activity";
import { ActivityChart, HourOfDayChart, ShareList, SignupsChart } from "./charts";
import {
  formatAverage,
  formatCount,
  formatDay,
  formatHour,
  formatMeasuredAt,
  percent,
  providerLabel,
  withShares,
} from "./format";
import { PERIODS, periodHours, periodHref, type PeriodKey } from "./periods";

type Loaded<T> = Result<T, "load_failed">;

/** Everything the page shows, each part read on its own so one failure does not blank the others. */
export type StatisticsData = {
  overview: Loaded<StatsOverview>;
  /** The last 30 days, one row per hour; the window of the selected period is cut from it. */
  activity: Loaded<ActivityHour[]>;
  breakdown: Loaded<StatsBreakdown>;
  roles: Loaded<Role[]>;
};

/** Title of a group of the page. */
function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="section-title">
      {children}
    </h3>
  );
}

/** A big figure with its label and an optional hint. */
function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** Why a part has nothing to show: an empty state, not an error. */
function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function LoadError({ what }: { what: string }) {
  return (
    <p role="alert" className="alert alert-error">
      Impossible de charger {what} pour le moment.
    </p>
  );
}

/** Label and value of a small fact under a chart. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  );
}

/** Active users over a window of the last `hours`, as a share of the accounts, with a note while the measure is partial. */
function activeHint(overview: StatsOverview, active: number, hours: number, now: number): string {
  if (!overview.trackingSince) return "Mesure en attente";
  const since = Date.parse(overview.trackingSince);
  if (since > now - hours * 3_600_000)
    return `Mesuré depuis le ${formatDay(overview.trackingSince)}`;
  const share = percent(active, overview.usersTotal);
  return share === null ? "" : `${share} % des inscrits`;
}

function Overview({ overview, now }: { overview: StatsOverview; now: number }) {
  const measured = overview.trackingSince !== null;
  const active = (value: number) => (measured ? formatCount(value) : "—");
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile
        label="Inscrits"
        value={formatCount(overview.usersTotal)}
        hint={`+${formatCount(overview.signups7d)} sur 7 jours`}
      />
      <Tile
        label="Inscriptions (24 h)"
        value={formatCount(overview.signups24h)}
        hint={`${formatCount(overview.signups30d)} sur 30 jours`}
      />
      <Tile
        label="Actifs (24 h)"
        value={active(overview.active24h)}
        hint={activeHint(overview, overview.active24h, 24, now)}
      />
      <Tile
        label="Actifs (7 j)"
        value={active(overview.active7d)}
        hint={activeHint(overview, overview.active7d, 168, now)}
      />
      <Tile
        label="Actifs (30 j)"
        value={active(overview.active30d)}
        hint={activeHint(overview, overview.active30d, 720, now)}
      />
      <Tile label="Bannis en cours" value={formatCount(overview.bannedNow)} />
    </div>
  );
}

function ActivityCard({ rows }: { rows: ActivityHour[] }) {
  const summary = summarizeActivity(rows);
  const firstTracked = rows.find((row) => row.tracked);
  const partial = firstTracked && firstTracked !== rows[0];
  return (
    <div className="card flex flex-col gap-3 p-4">
      <h4 className="font-semibold">Utilisateurs actifs par heure</h4>
      {summary.trackedHours === 0 ? (
        <Empty>
          L&apos;activité n&apos;est pas encore mesurée : les premières données arrivent dès
          qu&apos;un utilisateur connecté ouvre l&apos;application (une mesure par heure).
        </Empty>
      ) : (
        <>
          <ActivityChart rows={rows} peak={summary.peak} />
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Pic">
              {summary.peak ? (
                <>
                  {formatCount(summary.peak.value)}{" "}
                  <span className="font-normal text-muted">· {formatHour(summary.peak.hour)}</span>
                </>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label="Moyenne par heure">
              {summary.average === null ? "—" : formatAverage(summary.average)}
            </Fact>
          </dl>
          {partial && firstTracked && (
            <p className="text-xs text-faint">
              Mesure active depuis le {formatDay(firstTracked.hour)} : avant, la courbe est vide.
            </p>
          )}
          <p className="text-xs text-faint">
            Un utilisateur est compté une fois par heure, dès qu&apos;il ouvre l&apos;application.
            L&apos;heure en cours n&apos;est pas terminée.
          </p>
        </>
      )}
    </div>
  );
}

function SignupsCard({ rows }: { rows: ActivityHour[] }) {
  const summary = summarizeSignups(rows);
  return (
    <div className="card flex flex-col gap-3 p-4">
      <h4 className="font-semibold">Inscriptions par heure</h4>
      {summary.total === 0 ? (
        <Empty>Aucune inscription sur cette période.</Empty>
      ) : (
        <>
          <SignupsChart rows={rows} total={summary.total} />
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Total">{formatCount(summary.total)}</Fact>
            <Fact label="Meilleure heure">
              {summary.best ? (
                <>
                  {formatCount(summary.best.value)}{" "}
                  <span className="font-normal text-muted">· {formatHour(summary.best.hour)}</span>
                </>
              ) : (
                "—"
              )}
            </Fact>
          </dl>
        </>
      )}
    </div>
  );
}

function PeakHours({ rows }: { rows: ActivityHour[] }) {
  const profile = hourOfDayProfile(rows);
  const samples = profile.reduce((sum, slot) => sum + slot.samples, 0);
  const busiest = busiestHours(profile);
  const top = busiest[0];
  return (
    <div className="card flex flex-col gap-3 p-4">
      {samples === 0 || !top ? (
        <Empty>
          Pas encore assez de données : ce graphique se remplit avec l&apos;activité mesurée sur 30
          jours.
        </Empty>
      ) : (
        <>
          <HourOfDayChart profile={profile} />
          <p className="text-sm">
            Le plus fréquenté :{" "}
            <span className="font-semibold">
              {busiest.map((slot) => `${slot.hour} h`).join(", ")}
            </span>{" "}
            <span className="text-muted">
              (en moyenne {formatAverage(top.average ?? 0)} utilisateurs)
            </span>
          </p>
          <p className="text-xs text-faint">
            Moyenne sur les {formatCount(samples)} heures mesurées des 30 derniers jours, heure de
            Paris.
          </p>
        </>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <h4 className="font-semibold">{title}</h4>
      {children}
      {note && <p className="text-xs text-faint">{note}</p>}
    </div>
  );
}

function Breakdown({ breakdown, roles }: { breakdown: StatsBreakdown; roles: Role[] | null }) {
  const roleLabel = (key: string) => roles?.find((role) => role.key === key)?.label ?? key;
  const countryLabel = (key: string) =>
    key === "unknown" ? "Inconnu" : `${countryFlag(key)} ${countryName(key)}`.trim();
  const sections = [
    { title: "Rôles", shares: withShares(breakdown.roles), labelOf: roleLabel, note: undefined },
    {
      title: "Méthode d'inscription",
      shares: withShares(breakdown.providers),
      labelOf: providerLabel,
      note: "Le premier fournisseur utilisé pour créer le compte.",
    },
    {
      title: "Pays d'inscription",
      shares: withShares(breakdown.countries),
      labelOf: countryLabel,
      note: "Déduit de l'adresse IP à l'inscription ; les comptes plus anciens que le suivi sont « Inconnu ».",
    },
  ];
  return (
    <>
      {sections.map((section) => (
        <BreakdownCard key={section.title} title={section.title} note={section.note}>
          {section.shares.length === 0 ? (
            <Empty>Aucune donnée.</Empty>
          ) : (
            <ShareList shares={section.shares} labelOf={section.labelOf} />
          )}
        </BreakdownCard>
      ))}
    </>
  );
}

/** The statistics page, from data already read: pure, so it renders the same with any data. */
export function StatisticsDashboard({
  data,
  period,
  now,
}: {
  data: StatisticsData;
  period: PeriodKey;
  /** Instant the figures were read, in milliseconds. */
  now: number;
}) {
  const allRows = data.activity.ok ? data.activity.value : null;
  const windowRows = allRows ? lastHours(allRows, periodHours(period)) : null;

  return (
    <div className="flex flex-col gap-section">
      <p className="text-xs text-faint">
        Chiffres lus le {formatMeasuredAt(new Date(now).toISOString())} (heure de Paris).
      </p>

      <section aria-labelledby="overview-title" className="flex flex-col gap-2">
        <SectionTitle id="overview-title">Vue d&apos;ensemble</SectionTitle>
        {data.overview.ok ? (
          <Overview overview={data.overview.value} now={now} />
        ) : (
          <LoadError what="les chiffres clés" />
        )}
      </section>

      <section aria-labelledby="trend-title" className="flex flex-col gap-3">
        <SectionTitle id="trend-title">Évolution</SectionTitle>
        <ChipTabs
          label="Période"
          activeKey={period}
          tabs={PERIODS.map((item) => ({
            key: item.key,
            label: item.label,
            href: periodHref(item.key),
          }))}
        />
        {windowRows ? (
          <>
            <ActivityCard rows={windowRows} />
            <SignupsCard rows={windowRows} />
          </>
        ) : (
          <LoadError what="les courbes" />
        )}
      </section>

      <section aria-labelledby="peak-title" className="flex flex-col gap-2">
        <SectionTitle id="peak-title">Heures de pointe</SectionTitle>
        {allRows ? <PeakHours rows={allRows} /> : <LoadError what="les heures de pointe" />}
      </section>

      <section aria-labelledby="breakdown-title" className="flex flex-col gap-3">
        <SectionTitle id="breakdown-title">Répartition des comptes</SectionTitle>
        {data.breakdown.ok ? (
          <Breakdown
            breakdown={data.breakdown.value}
            roles={data.roles.ok ? data.roles.value : null}
          />
        ) : (
          <LoadError what="la répartition" />
        )}
      </section>

      {data.overview.ok && (
        <section aria-labelledby="content-title" className="flex flex-col gap-2">
          <SectionTitle id="content-title">Contenu</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Posts publics" value={formatCount(data.overview.value.postsPublic)} />
            <Tile
              label="Événements à venir"
              value={formatCount(data.overview.value.eventsUpcoming)}
              hint={`sur ${formatCount(data.overview.value.eventsTotal)} au total`}
            />
            <Tile
              label="Positions déclarées"
              value={formatCount(data.overview.value.positionsActive)}
              hint="non retirées"
            />
          </div>
        </section>
      )}
    </div>
  );
}
