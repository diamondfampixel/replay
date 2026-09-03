import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONTS } from "@/lib/storefront/theme";
import { FONT_LICENSES, FONT_USAGE } from "@/lib/storefront/font-licenses";

/**
 * Every font the design system can expose must have a verified license entry
 * and its license text on disk. A new family without paperwork fails here.
 */
describe("font license manifest", () => {
  it("covers every family in the design system and nothing else", () => {
    const keys = Object.keys(FONTS).sort();
    expect(FONT_LICENSES.map((f) => f.key).sort()).toEqual(keys);
    for (const entry of FONT_LICENSES) expect(entry.family).toBe(FONTS[entry.key as keyof typeof FONTS].family);
  });

  it("every entry is OFL 1.1 with the license text preserved in the repository", () => {
    for (const entry of FONT_LICENSES) {
      expect(entry.license).toBe("SIL Open Font License");
      expect(entry.version).toBe("1.1");
      const file = join(process.cwd(), entry.licenseFile);
      expect(existsSync(file), `${entry.family}: ${entry.licenseFile} missing`).toBe(true);
      const text = readFileSync(file, "utf8");
      expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
      expect(text.toLowerCase()).toContain("copyright");
      expect(entry.officialSource).toMatch(/^https:\/\/github\.com\/google\/fonts\/tree\/main\/ofl\//);
    }
  });

  it("records that Halyard never redistributes, modifies or self-hosts font files", () => {
    expect(FONT_USAGE.selfHosted).toBe(false);
    expect(FONT_USAGE.modified).toBe(false);
    expect(FONT_USAGE.redistribution).toBe("not performed");
  });

  it("the storefront only ever loads fonts from Google Fonts", () => {
    const theme = readFileSync(join(process.cwd(), "src/lib/storefront/theme.ts"), "utf8");
    expect(theme).toContain("https://fonts.googleapis.com/css2?");
    expect(theme).not.toMatch(/@font-face|typekit|fonts\.adobe|use\.typekit/);
  });
});
