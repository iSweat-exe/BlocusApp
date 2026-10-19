"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { confirmTotpEnrollment, startTotpEnrollment } from "./actions";
import { CodeField } from "./code-field";
import { formatSecret, isValidCode } from "./mfa";

type Enrollment = { factorId: string; qrCode: string; secret: string };

/**
 * Enrollment of an authenticator app in three moves: the button asks Auth for a secret, the person scans the QR
 * code (or types the secret), then enters the first code to prove the app works. Nothing is kept until that code is
 * right. The page refreshes afterwards: the session is then AAL2 and the screens that waited for it open.
 */
export function TotpEnrollment() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    const result = await startTotpEnrollment();
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEnrollment({ factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setPending(true);
    setError(null);
    const result = await confirmTotpEnrollment(enrollment.factorId, code);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setCode("");
      return;
    }
    router.refresh();
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={start} disabled={pending} className="btn btn-primary w-full">
          {pending ? "Préparation…" : "Activer la double authentification"}
        </button>
        {error && (
          <p role="alert" className="text-feedback-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          Ouvre ton application d&apos;authentification (Google Authenticator, Aegis, 1Password…).
        </li>
        <li>Scanne ce code QR, ou saisis la clé ci-dessous.</li>
        <li>Entre le code à six chiffres qu&apos;elle affiche.</li>
      </ol>
      {/* On white, whatever the theme: a QR code needs a light background to be scanned. */}
      <div className="mx-auto rounded-card bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URI built by Auth, nothing to optimize */}
        <img
          src={enrollment.qrCode}
          alt="Code QR à scanner avec ton application d'authentification"
          width={176}
          height={176}
        />
      </div>
      <p className="text-center text-xs text-muted">
        Clé à saisir :{" "}
        <code className="select-all font-mono text-sm text-foreground">
          {formatSecret(enrollment.secret)}
        </code>
      </p>
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
        {pending ? "Vérification…" : "Confirmer"}
      </button>
    </form>
  );
}
