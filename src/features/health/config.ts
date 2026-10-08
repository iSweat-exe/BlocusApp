/** One check of the environment configuration. Values are never read out, only their presence. */
export type ConfigCheck = {
  key: string;
  label: string;
  /** What it is for, shown when the check fails. */
  hint: string;
  ok: boolean;
  /** Optional checks are shown but do not count in the score. */
  required: boolean;
};

type Env = Readonly<Record<string, string | undefined>>;

/** Checks that the environment variables the operations depend on are set (see `docs/runbook.md`). */
export function checkConfiguration(env: Env = process.env): ConfigCheck[] {
  const has = (...keys: string[]) => keys.every((key) => Boolean(env[key]));
  return [
    {
      key: "CRON_SECRET",
      label: "Secret du cron",
      hint: "Sans lui, /api/keep-alive est ouvert à tout le monde.",
      ok: has("CRON_SECRET"),
      required: true,
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Clé service Supabase",
      hint: "Sans elle, le cron n'enregistre pas d'historique.",
      ok: has("SUPABASE_SERVICE_ROLE_KEY"),
      required: true,
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      label: "Adresse du site",
      hint: "Utilisée pour le retour de la connexion Discord et Google.",
      ok: has("NEXT_PUBLIC_SITE_URL"),
      required: true,
    },
    {
      key: "VERCEL_API_TOKEN",
      label: "Jeton Vercel",
      hint: "Sans lui, l'état du déploiement n'est pas lu.",
      ok: has("VERCEL_API_TOKEN", "VERCEL_PROJECT_ID"),
      required: false,
    },
  ];
}

/** Share of the required checks that pass, from 0 to 1. */
export function configShare(checks: readonly ConfigCheck[]): number {
  const required = checks.filter((check) => check.required);
  return required.length === 0 ? 1 : required.filter((check) => check.ok).length / required.length;
}
