import { CreditsView } from "@/features/credits/credits-view";
import { GITHUB_REPOSITORY } from "@/features/credits/team";
import { getContributorStats } from "@/lib/data/github-stats";

// The same for everybody (Guests and signed-in users): the contribution figures come from GitHub through a shared
// cache, refreshed every 15 minutes. If GitHub does not answer, the page is complete without them.
export default async function CreditsPage() {
  const stats = await getContributorStats(GITHUB_REPOSITORY);
  return <CreditsView stats={stats.ok ? stats.value : {}} />;
}
