/**
 * Platform operators — the people who run Halyard, as opposed to merchants
 * who run stores on it. Granted by email through HALYARD_PLATFORM_ADMINS
 * (comma-separated). Nothing in the database confers it, so a compromised
 * merchant account can never promote itself.
 */
export function platformAdminEmails(): string[] {
  return (process.env.HALYARD_PLATFORM_ADMINS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.trim().toLowerCase());
}
