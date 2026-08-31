import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { ensureHomepage } from "@/lib/services/provision";
import {
  discardDraft, getEditablePage, publishPage, saveDraftSections,
  createContentPage, updateContentPage,
} from "@/lib/services/pages";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let pageId: string;

beforeAll(async () => {
  const setup = await createTestStore("pages");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
  const page = await ensureHomepage(testDb, ctx.storeId);
  pageId = page.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("draft and publish", () => {
  it("saving a draft does not change what visitors see", async () => {
    const before = await getEditablePage(ctx, pageId);
    const hero = before.sections.find((section) => section.type === "hero")!;

    await saveDraftSections(
      ctx,
      pageId,
      before.sections.map((section) =>
        section.id === hero.id
          ? { ...section, config: { ...section.config, headline: "Draft headline" } }
          : section,
      ),
    );

    // The live rows are untouched.
    const liveSection = await testDb.pageSection.findUniqueOrThrow({ where: { id: hero.id } });
    expect((liveSection.config as { headline: string }).headline).not.toBe("Draft headline");

    const after = await getEditablePage(ctx, pageId);
    expect(after.hasUnpublishedChanges).toBe(true);
    expect(
      (after.sections.find((section) => section.id === hero.id)!.config as { headline: string }).headline,
    ).toBe("Draft headline");
  });

  it("publishing writes the draft onto the live sections", async () => {
    await publishPage(ctx, pageId);

    const page = await testDb.page.findUniqueOrThrow({
      where: { id: pageId },
      include: { sections: { orderBy: { position: "asc" } } },
    });
    expect(page.draftSections).toBeNull();
    expect(page.published).toBe(true);

    const hero = page.sections.find((section) => section.type === "hero")!;
    expect((hero.config as { headline: string }).headline).toBe("Draft headline");

    const editable = await getEditablePage(ctx, pageId);
    expect(editable.hasUnpublishedChanges).toBe(false);
  });

  it("adds, removes and reorders sections on publish", async () => {
    const current = await getEditablePage(ctx, pageId);
    const reordered = [...current.sections].reverse();
    const withNew = [
      ...reordered,
      { id: "draft-new", type: "customBanner" as const, visible: true, config: { heading: "Added by test" } },
    ];
    // Drop the last of the original sections.
    withNew.splice(0, 1);

    await saveDraftSections(ctx, pageId, withNew);
    await publishPage(ctx, pageId);

    const page = await testDb.page.findUniqueOrThrow({
      where: { id: pageId },
      include: { sections: { orderBy: { position: "asc" } } },
    });
    expect(page.sections).toHaveLength(withNew.length);
    expect(page.sections.at(-1)?.type).toBe("customBanner");
    expect((page.sections.at(-1)?.config as { heading: string }).heading).toBe("Added by test");
    // Positions are contiguous from zero.
    expect(page.sections.map((section) => section.position)).toEqual(
      page.sections.map((_, index) => index),
    );
  });

  it("discards a draft back to the live version", async () => {
    const before = await getEditablePage(ctx, pageId);
    await saveDraftSections(
      ctx,
      pageId,
      before.sections.map((section) => ({ ...section, config: { ...section.config, heading: "Throwaway" } })),
    );
    expect((await getEditablePage(ctx, pageId)).hasUnpublishedChanges).toBe(true);

    await discardDraft(ctx, pageId);
    const after = await getEditablePage(ctx, pageId);
    expect(after.hasUnpublishedChanges).toBe(false);
    expect(after.sections).toEqual(before.live);
  });

  it("rejects a draft with no valid sections", async () => {
    await expect(saveDraftSections(ctx, pageId, [])).rejects.toThrow(/at least one valid section/i);
    await expect(
      saveDraftSections(ctx, pageId, [{ type: "not_a_real_section", config: {} }]),
    ).rejects.toThrow();
  });

  it("fills defaults for a section saved with a partial config", async () => {
    await saveDraftSections(ctx, pageId, [
      { id: "draft-hero", type: "hero", visible: true, config: { headline: "Only a headline" } },
    ]);
    const editable = await getEditablePage(ctx, pageId);
    const hero = editable.sections[0];
    expect(hero.config.headline).toBe("Only a headline");
    // Defaults from the section schema are materialised.
    expect(hero.config.ctaHref).toBe("/shop");
    expect(hero.config.background).toBeDefined();
    await discardDraft(ctx, pageId);
  });
});

describe("content pages", () => {
  it("creates a page unpublished with a unique slug", async () => {
    const first = await createContentPage(ctx, { title: "Shipping Info", body: "<p>Two days.</p>" });
    const second = await createContentPage(ctx, { title: "Shipping Info", body: "<p>Also two days.</p>" });
    expect(first.slug).toBe("shipping-info");
    expect(second.slug).toBe("shipping-info-2");
    expect(first.published).toBe(false);
  });

  it("sanitises HTML on save", async () => {
    const page = await createContentPage(ctx, {
      title: "Risky",
      body: '<p>Safe</p><script>alert("xss")</script><a href="javascript:alert(1)">bad link</a><img src="x" onerror="alert(1)">',
    });
    expect(page.body).toContain("<p>Safe</p>");
    expect(page.body).not.toContain("<script");
    expect(page.body).not.toContain("javascript:");
    expect(page.body).not.toContain("onerror");
  });

  it("keeps allowed markup intact", () => {
    const html = sanitizeHtml(
      '<h2>Title</h2><p>Text with <strong>bold</strong> and <a href="/shop" title="Shop">a link</a>.</p><ul><li>One</li></ul>',
    );
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>");
    expect(html).toContain('href="/shop"');
    expect(html).toContain("<li>");
  });

  it("publishes and unpublishes", async () => {
    const page = await createContentPage(ctx, { title: "Returns Policy", body: "<p>60 days.</p>" });
    const published = await updateContentPage(ctx, page.id, { title: page.title, published: true });
    expect(published.published).toBe(true);
    expect(published.publishedAt).toBeTruthy();

    const hidden = await updateContentPage(ctx, page.id, { title: page.title, published: false });
    expect(hidden.published).toBe(false);
  });
});

describe("section config validation", () => {
  it("keeps valid fields when one field is malformed", async () => {
    const { normaliseSectionConfig } = await import("@/lib/storefront/sections");

    const config = normaliseSectionConfig("benefits", {
      // A null heading used to make the whole section fall back to defaults,
      // silently dropping the items with it.
      heading: null,
      items: [
        { title: "Made in small batches", body: "Short runs with mills we know." },
        { title: "Free returns", body: "Sixty days, no forms." },
      ],
    });

    expect(config.items).toHaveLength(2);
    expect((config.items as Array<{ title: string }>)[0].title).toBe("Made in small batches");
    expect(config.heading).toBe("");
  });

  it("drops only the invalid key, not the section", async () => {
    const { normaliseSectionConfig } = await import("@/lib/storefront/sections");

    const config = normaliseSectionConfig("hero", {
      headline: "A real headline",
      // Not a valid enum member.
      height: "enormous",
      ctaLabel: "Shop",
    });

    expect(config.headline).toBe("A real headline");
    expect(config.ctaLabel).toBe("Shop");
    expect(config.height).toBe("large"); // schema default
  });

  it("still falls back entirely when nothing is salvageable", async () => {
    const { normaliseSectionConfig } = await import("@/lib/storefront/sections");
    const config = normaliseSectionConfig("hero", "not an object");
    expect(config.headline).toBeTruthy();
  });
});
