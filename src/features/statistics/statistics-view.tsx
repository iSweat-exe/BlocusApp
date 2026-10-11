import { listRoles } from "@/lib/data/profiles";
import {
  getStatsActivity,
  getStatsBreakdown,
  getStatsOverview,
  MAX_ACTIVITY_HOURS,
} from "@/lib/data/statistics";
import type { PeriodKey } from "./periods";
import { StatisticsDashboard, type StatisticsData } from "./statistics-dashboard";

/** Reads every part of the page together; each read can fail on its own. `now` is when the figures were read. */
async function loadStatistics(): Promise<{ data: StatisticsData; now: number }> {
  const [overview, activity, breakdown, roles] = await Promise.all([
    getStatsOverview(),
    getStatsActivity(MAX_ACTIVITY_HOURS),
    getStatsBreakdown(),
    listRoles(),
  ]);
  return { data: { overview, activity, breakdown, roles }, now: Date.now() };
}

/**
 * Statistics of the application: headline figures, activity and sign-ups per hour, busiest hours of the day and
 * distribution of the accounts. The caller must have checked `statistics.view`; the database functions check it
 * again and answer nothing otherwise, and it must have opted out of static rendering (`connection()`): the
 * figures depend on the current time.
 */
export async function StatisticsView({ period }: { period: PeriodKey }) {
  const { data, now } = await loadStatistics();
  return <StatisticsDashboard data={data} period={period} now={now} />;
}
