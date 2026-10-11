import { getPublicUserCount } from "@/lib/data/user-count";

const countFormat = new Intl.NumberFormat("fr-FR");

/**
 * « Déjà 842 personnes ont rejoint BLOCUS. » under the login buttons. Shows nothing when the figure cannot be read
 * (migration not applied yet, database down) or when nobody has signed up: a missing line is better than « 0 ».
 */
export async function MemberCount() {
  const result = await getPublicUserCount();
  if (!result.ok || result.value < 1) return null;

  const count = result.value;
  return (
    <p className="text-center text-xs text-muted">
      Déjà{" "}
      <span className="font-semibold text-foreground tabular-nums">
        {countFormat.format(count)}
      </span>{" "}
      {count > 1 ? "personnes ont rejoint" : "personne a rejoint"} BLOCUS
      <span className="text-accent">.</span>
    </p>
  );
}
