"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAdminMfaRequired } from "./actions";

/**
 * Turns the rule on or off. Turning it on asks for a second tap ("Confirmer"): it takes the administrator rights
 * away from every administrator who did not enroll yet, until they do.
 */
export function AdminMfaToggle({ required }: { required: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    setError(null);
    const result = await setAdminMfaRequired(next);
    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {confirming && !required && (
        <p role="alert" className="alert border-warning/40 bg-warning/10 text-sm">
          Les administrateurs sans double authentification perdront leurs droits
          d&apos;administration jusqu&apos;à l&apos;avoir activée. Ils peuvent le faire eux-mêmes
          dans Réglages.
        </p>
      )}
      {error && (
        <p role="alert" className="text-feedback-error">
          {error}
        </p>
      )}
      {required ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void apply(false)}
          className="btn btn-outline w-full"
        >
          {pending ? "…" : "Rendre facultative"}
        </button>
      ) : confirming ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="btn btn-outline flex-1"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void apply(true)}
            className="btn btn-primary flex-1"
          >
            {pending ? "…" : "Confirmer"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn btn-primary w-full"
        >
          Rendre obligatoire
        </button>
      )}
    </div>
  );
}
