import { describe, expect, it, vi } from "vitest";
import { normalizeDatabaseUrl } from "@/lib/database-url";

// Placeholder credentials only: this string reaches no database.
const URL = "postgresql://app_user:pa55-w0rd@ep-example-123456-pooler.us-east-2.aws.neon.tech/halyard?sslmode=require&channel_binding=require";

describe("normalizeDatabaseUrl", () => {
  it("leaves a bare URL untouched, query parameters included", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeDatabaseUrl(URL)).toBe(URL);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("unwraps the shapes dashboards hand out", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const pasted of [
      `DATABASE_URL=${URL}`,
      `DATABASE_URL_UNPOOLED="${URL}"`,
      `export DATABASE_URL='${URL}'`,
      `"${URL}"`,
      `'${URL}'`,
      `psql '${URL}'`,
      `  ${URL}\n`,
      `${URL};`,
    ]) {
      expect(normalizeDatabaseUrl(pasted), pasted.slice(0, 24)).toBe(URL);
    }
    expect(warn).toHaveBeenCalled();
    // The warning names the variable, never the value.
    for (const call of warn.mock.calls) expect(String(call[0])).not.toContain("pa55-w0rd");
    warn.mockRestore();
  });

  it("returns undefined for missing or empty values", () => {
    expect(normalizeDatabaseUrl(undefined)).toBeUndefined();
    expect(normalizeDatabaseUrl("")).toBeUndefined();
    expect(normalizeDatabaseUrl('""')).toBeUndefined();
  });
});
