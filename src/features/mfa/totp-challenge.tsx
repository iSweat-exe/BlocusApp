"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { verifyTotpCode } from "./actions";
import { CodeField } from "./code-field";
import { isValidCode } from "./mfa";

/**
 * Asks for the code of the person's authenticator app and, once right, raises the session to AAL2: the page then
 * refreshes with the new session cookies (the second factor screen goes away on its own).
 */
export function TotpChallenge({ submitLabel = "Valider" }: { submitLabel?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await verifyTotpCode(code);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setCode("");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <CodeField value={code} onChange={setCode} />
      {error && (
        <p role="alert" className="text-feedback-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !isValidCode(code)}
        className="btn btn-primary w-full"
      >
        {pending ? "Vérification…" : submitLabel}
      </button>
    </form>
  );
}
