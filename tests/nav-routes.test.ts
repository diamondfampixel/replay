import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV, SETTINGS_NAV } from "@/lib/nav";

/**
 * Every link the operator can click in the primary navigation must resolve to a
 * real App Router page. A renamed or deleted route otherwise ships a nav item
 * that dead-ends on a 404 — exactly the class of bug this guard exists to catch.
 * It maps each nav href to the page.tsx the router would serve and asserts the
 * file exists, so the failure surfaces at test time instead of in the product.
 */

const APP_DIR = join(process.cwd(), "src/app/(admin)");

/** "/admin/settings/ai" -> "src/app/(admin)/admin/settings/ai/page.tsx" */
function pageFileForHref(href: string): string {
  const segments = href.replace(/^\//, "").split("/");
  return join(APP_DIR, ...segments, "page.tsx");
}

const adminHrefs = ADMIN_NAV.flatMap((group) => group.items.map((item) => item.href));
const settingsHrefs = SETTINGS_NAV.flatMap((group) => group.items.map((item) => item.href));
const allHrefs = [...new Set([...adminHrefs, ...settingsHrefs])];

describe("navigation routes resolve to real pages", () => {
  it.each(allHrefs)("%s has a page.tsx", (href) => {
    expect(existsSync(pageFileForHref(href)), `${href} → ${pageFileForHref(href)} missing`).toBe(true);
  });

  it("covers the whole primary sidebar (guards against an emptied nav)", () => {
    expect(adminHrefs.length).toBeGreaterThanOrEqual(15);
  });
});
