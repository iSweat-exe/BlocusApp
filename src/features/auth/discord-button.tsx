"use client";

import { useFormStatus } from "react-dom";
import { signInWithDiscord } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[#5865F2] px-4 py-3 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Redirection…" : "Continuer avec Discord"}
    </button>
  );
}

/** "Continue with Discord" form wired to the `signInWithDiscord` Server Action. */
export function DiscordButton() {
  return (
    <form action={signInWithDiscord}>
      <SubmitButton />
    </form>
  );
}
