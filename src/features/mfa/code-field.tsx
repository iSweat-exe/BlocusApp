import { TOTP_CODE_LENGTH } from "./mfa";

/**
 * The field of the six-digit code of an authenticator app: numeric keypad, one-time-code autofill, spaces allowed
 * (apps show « 123 456 »). Controlled by the parent.
 */
export function CodeField({
  value,
  onChange,
  label = "Code à six chiffres",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        name="code"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={TOTP_CODE_LENGTH + 1}
        spellCheck={false}
        required
        className="field text-center text-xl tracking-[0.3em] tabular-nums"
      />
    </label>
  );
}
