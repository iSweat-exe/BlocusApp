"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { disableTotp } from "./actions";
import { CodeField } from "./code-field";
import { isValidCode } from "./mfa";

/** Removes the authenticator, after the current code: a stolen session alone cannot turn the protection off. */
export function TotpDisable() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await disableTotp(code);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setCode("");
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm">
        Désactiver
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm">Entre ton code actuel pour désactiver la double authentification.</p>
      <CodeField value={code} onChange={setCode} />
      {error && (
        <p role="alert" className="text-feedback-error">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-outline flex-1">
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending || !isValidCode(code)}
          className="btn btn-danger flex-1"
        >
          {pending ? "…" : "Désactiver"}
        </button>
      </div>
    </form>
  );
}
