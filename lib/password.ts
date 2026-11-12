import type { User } from "@supabase/supabase-js";

/** The shortest password Pheelm accepts. Set the same minimum in Supabase → Authentication → Providers → Email. */
export const MIN_PASSWORD = 8;

/**
 * True for members who sign in by email but haven't chosen a password yet (accounts made before
 * passwords, or by code). Google-only accounts are left alone. `has_password` is only a reminder
 * flag: Supabase itself checks the password.
 */
export function needsPassword(user: Pick<User, "user_metadata" | "app_metadata"> | null | undefined) {
  if (!user) return false;
  if (user.user_metadata?.has_password) return false;
  const providers: string[] = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [user.app_metadata?.provider].filter((p): p is string => typeof p === "string");
  return providers.length === 0 || providers.every((p) => p === "email");
}
