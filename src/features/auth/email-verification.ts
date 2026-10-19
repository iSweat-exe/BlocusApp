/** The part of a Supabase user needed to decide whether its e-mail address was verified by the provider. */
export type VerifiableUser = {
  email?: string | null;
  email_confirmed_at?: string | null;
  identities?: { identity_data?: Record<string, unknown> | null }[] | null;
};

/**
 * Whether a user signed in with an e-mail address the provider (Discord, Google) vouches for.
 * An account is refused when it has no address, when Supabase did not confirm it, or when an identity reports
 * `email_verified: false` (Discord lets people attach an address they never confirmed).
 */
export function hasVerifiedEmail(user: VerifiableUser | null | undefined): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return !(user.identities ?? []).some(
    (identity) => identity.identity_data?.email_verified === false,
  );
}

/**
 * Whether the error the provider sent back to the callback (`error_description`) says the sign-in failed because
 * no usable e-mail address came with it (Supabase: "Error getting user email from external provider").
 */
export function isMissingEmailError(description: string | null): boolean {
  return description !== null && /user email|email.*(not|unverified)/i.test(description);
}
