/**
 * Helpers for OAuth / Google user_metadata → profile name fields.
 */
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function splitFullName(fullName: string): {
  firstName: string;
  surname: string;
} {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", surname: "" };
  const i = trimmed.indexOf(" ");
  if (i === -1) return { firstName: trimmed, surname: "" };
  return { firstName: trimmed.slice(0, i), surname: trimmed.slice(i + 1) };
}

/** Extract first + surname from Google / OAuth metadata. */
export function namesFromAuthMetadata(meta: Record<string, unknown> | undefined): {
  firstName: string;
  surname: string;
} {
  if (!meta) return { firstName: "", surname: "" };

  const str = (key: string) => {
    const v = meta[key];
    return typeof v === "string" ? v.trim() : "";
  };

  let firstName = str("first_name") || str("given_name");
  let surname = str("surname") || str("family_name");

  if (!firstName || !surname) {
    const full = str("full_name") || str("name");
    if (full) {
      const split = splitFullName(full);
      if (!firstName) firstName = split.firstName;
      if (!surname) surname = split.surname;
    }
  }

  return { firstName, surname };
}

export function namesFromAuthUser(user: SupabaseUser): {
  firstName: string;
  surname: string;
} {
  return namesFromAuthMetadata(
    (user.user_metadata ?? {}) as Record<string, unknown>,
  );
}

/** Username rules for CompleteProfile / signup. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function normalizeUsername(raw: string): string {
  return raw.trim();
}

export function validateUsernameFormat(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (u.length > USERNAME_MAX) {
    return `Username must be at most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_PATTERN.test(u)) {
    return "Use letters, numbers, and underscores only.";
  }
  return null;
}
