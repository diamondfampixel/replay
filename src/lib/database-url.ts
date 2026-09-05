/**
 * Normalises a database connection string pasted into a host's environment
 * settings. Dashboards hand these out in several shapes — a bare URL, a
 * `.env` line (`DATABASE_URL=postgresql://…`), a `psql '…'` command, or a
 * value wrapped in quotes — and Prisma rejects everything but the bare URL
 * with P1013 ("The provided database string is invalid").
 *
 * Only the wrapping is removed; the URL itself is never altered, so
 * credentials, hosts and query parameters pass through exactly as given.
 * A repaired value is reported (without its contents) so the setting can be
 * cleaned up at the source.
 */
export function normalizeDatabaseUrl(raw: string | undefined, name = "DATABASE_URL"): string | undefined {
  if (raw === undefined) return undefined;
  let value = raw.trim();
  const original = value;

  // psql 'postgresql://…'  /  psql "postgresql://…"
  value = value.replace(/^psql\s+/i, "").trim();
  // NAME=postgresql://…  or  export NAME=postgresql://…
  value = value.replace(/^(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*/, "");
  // Surrounding quotes, possibly stacked.
  for (let i = 0; i < 2; i++) {
    const match = /^(['"`])([\s\S]*)\1$/.exec(value);
    if (!match) break;
    value = match[2].trim();
  }
  // A trailing `&` or `;` left by a copied command line.
  value = value.replace(/[;&]\s*$/, "");

  if (value !== original) {
    console.warn(
      `[database-url] ${name} was wrapped (quotes, a NAME= prefix or a psql command) and has been unwrapped for this run; fix the value in the host's environment settings.`,
    );
  }
  return value || undefined;
}
