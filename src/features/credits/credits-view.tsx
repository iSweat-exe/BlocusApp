import { Avatar } from "@/components/avatar";
import { ArrowUpRightIcon } from "@/components/icons";
import type { ContributorStats, ContributorStatsByLogin } from "@/lib/data/github-stats";
import { DEVELOPERS, githubAvatarUrl, githubUrl, STACK } from "./team";

const numberFormat = new Intl.NumberFormat("fr-FR");

/** Opens another site: new tab, without handing over `window.opener` or the referrer. */
const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * Commits and lines added / deleted, laid out like the Contributors tab of GitHub (« 91 commits 49 776 ++ 3 007 -- »).
 * The coloured figures are for the eyes; a sentence says the same to assistive technologies.
 */
function Stats({ stats }: { stats: ContributorStats }) {
  const commits = `${numberFormat.format(stats.commits)} commit${stats.commits > 1 ? "s" : ""}`;
  const added = numberFormat.format(stats.additions);
  const deleted = numberFormat.format(stats.deletions);
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs tabular-nums">
      <span aria-hidden="true" className="text-muted">
        {commits}
      </span>
      <span aria-hidden="true" className="font-semibold text-success">
        {added} ++
      </span>
      <span aria-hidden="true" className="font-semibold text-danger">
        {deleted} --
      </span>
      <span className="sr-only">
        {commits}, {added} lignes ajoutées, {deleted} lignes supprimées.
      </span>
    </span>
  );
}

/**
 * The credits: who develops the application (with their GitHub photo, profile and contribution figures) and what it
 * is built with. Pure: the figures come from the caller, and a developer without figures just has none shown.
 * @param stats - Contributor statistics by lower-case GitHub login; empty when GitHub could not be read.
 */
export function CreditsView({ stats = {} }: { stats?: ContributorStatsByLogin }) {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">Crédits</h1>
        <p className="text-sm text-muted">
          BLOCUS<span className="text-accent">.</span> est développée par :
        </p>
      </header>

      <section aria-labelledby="team-title" className="flex flex-col gap-2">
        <h2 id="team-title" className="section-title">
          L&apos;équipe
        </h2>
        <ul className="card divide-y divide-line overflow-hidden">
          {DEVELOPERS.map((developer) => (
            <li key={developer.github}>
              <a
                href={githubUrl(developer.github)}
                {...EXTERNAL}
                className="flex min-h-control items-center gap-3 px-4 py-3 [@media(hover:hover)]:hover:bg-foreground/5"
              >
                <Avatar
                  pseudo={developer.name}
                  url={githubAvatarUrl(developer.github)}
                  size="md"
                  decorative
                  className="bg-foreground/10"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{developer.name}</span>
                  <span className="block truncate text-sm text-muted">
                    github.com/{developer.github}
                  </span>
                  {stats[developer.github.toLowerCase()] && (
                    <Stats stats={stats[developer.github.toLowerCase()]!} />
                  )}
                </span>
                <ArrowUpRightIcon className="size-5 text-faint" />
                <span className="sr-only"> (GitHub, nouvel onglet)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stack-title" className="flex flex-col gap-2">
        <h2 id="stack-title" className="section-title">
          Construite avec
        </h2>
        <ul className="flex flex-wrap gap-2">
          {STACK.map((item) => (
            <li key={item.name}>
              <a href={item.url} {...EXTERNAL} className="chip bg-foreground/10 text-muted">
                {item.name}
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="px-1 text-xs text-faint">
          Fond de carte © OpenFreeMap, données © contributeurs OpenStreetMap.
        </p>
      </section>
    </div>
  );
}
