import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import {
  assignVariant, chooseWinner, createExperiment, getExperimentResults,
  recordConversions, recordExperimentEvent, setExperimentStatus, getAssignmentsFor,
  filterValidAssignments,
} from "@/lib/services/experiments";
import { ensureHomepage } from "@/lib/services/provision";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let pageId: string;
let sectionId: string;

beforeAll(async () => {
  const setup = await createTestStore("experiments");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;

  const page = await ensureHomepage(testDb, ctx.storeId);
  pageId = page.id;
  const section = await testDb.pageSection.findFirstOrThrow({
    where: { pageId, type: "hero" },
  });
  sectionId = section.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("variant assignment", () => {
  const variants = [
    { id: "v1", name: "A", weight: 50, changes: {} },
    { id: "v2", name: "B", weight: 50, changes: {} },
  ];

  it("is deterministic for a given session", () => {
    const first = assignVariant("exp-1", variants, "session-abc");
    const second = assignVariant("exp-1", variants, "session-abc");
    expect(first?.id).toBe(second?.id);
  });

  it("splits traffic close to the configured weights", () => {
    const counts: Record<string, number> = { v1: 0, v2: 0 };
    for (let i = 0; i < 4000; i++) {
      const variant = assignVariant("exp-weights", variants, `session-${i}`);
      if (variant) counts[variant.id] += 1;
    }
    // Allow a wide band; the point is that neither arm is starved.
    expect(counts.v1 / 4000).toBeGreaterThan(0.44);
    expect(counts.v1 / 4000).toBeLessThan(0.56);
  });

  it("respects uneven weights", () => {
    const skewed = [
      { id: "a", name: "A", weight: 90, changes: {} },
      { id: "b", name: "B", weight: 10, changes: {} },
    ];
    let aCount = 0;
    for (let i = 0; i < 3000; i++) {
      if (assignVariant("exp-skew", skewed, `s-${i}`)?.id === "a") aCount += 1;
    }
    expect(aCount / 3000).toBeGreaterThan(0.85);
    expect(aCount / 3000).toBeLessThan(0.95);
  });

  it("ignores zero-weight variants", () => {
    const paused = [
      { id: "a", name: "A", weight: 100, changes: {} },
      { id: "b", name: "B", weight: 0, changes: {} },
    ];
    for (let i = 0; i < 200; i++) {
      expect(assignVariant("exp-zero", paused, `s-${i}`)?.id).toBe("a");
    }
  });
});

describe("experiment lifecycle", () => {
  it("requires two variants and weights totalling 100", async () => {
    await expect(
      createExperiment(ctx, {
        name: "Too few", testType: "headline", targetType: "page", pageId, goal: "purchase",
        variants: [{ name: "A", weight: 100, changes: {} }],
      }),
    ).rejects.toThrow(/at least two variants/i);

    await expect(
      createExperiment(ctx, {
        name: "Bad weights", testType: "headline", targetType: "page", pageId, goal: "purchase",
        variants: [
          { name: "A", weight: 50, changes: { headline: "A" } },
          { name: "B", weight: 30, changes: { headline: "B" } },
        ],
      }),
    ).rejects.toThrow(/must total 100/i);
  });

  it("requires a target", async () => {
    await expect(
      createExperiment(ctx, {
        name: "No target", testType: "headline", targetType: "page", goal: "purchase",
        variants: [
          { name: "A", weight: 50, changes: { headline: "A" } },
          { name: "B", weight: 50, changes: { headline: "B" } },
        ],
      }),
    ).rejects.toThrow(/choose the page/i);
  });

  it("only serves variants for running experiments", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Serving test", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "Control copy" } },
        { name: "B", weight: 50, changes: { headline: "Challenger copy" } },
      ],
    });

    // Draft experiments never reach a visitor.
    expect(await getAssignmentsFor(ctx.storeId, { pageId }, "visitor-1")).toHaveLength(0);

    await setExperimentStatus(ctx, experiment.id, "RUNNING");
    const assignments = await getAssignmentsFor(ctx.storeId, { pageId }, "visitor-1");
    expect(assignments).toHaveLength(1);
    expect(["Control copy", "Challenger copy"]).toContain(assignments[0].changes.headline);

    await setExperimentStatus(ctx, experiment.id, "PAUSED");
    expect(await getAssignmentsFor(ctx.storeId, { pageId }, "visitor-1")).toHaveLength(0);
  });
});

describe("results", () => {
  it("computes rates, uplift and refuses to call a winner on thin data", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Thin data", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "A" } },
        { name: "B", weight: 50, changes: { headline: "B" } },
      ],
    });
    await setExperimentStatus(ctx, experiment.id, "RUNNING");
    const [control, challenger] = experiment.variants;

    // 10 visitors each, one conversion for B.
    for (let i = 0; i < 10; i++) {
      await recordExperimentEvent({
        experimentId: experiment.id, variantId: control.id,
        sessionId: `thin-a-${i}`, type: "impression",
      });
      await recordExperimentEvent({
        experimentId: experiment.id, variantId: challenger.id,
        sessionId: `thin-b-${i}`, type: "impression",
      });
    }
    await recordExperimentEvent({
      experimentId: experiment.id, variantId: challenger.id,
      sessionId: "thin-b-0", type: "conversion", value: 50,
    });

    const results = await getExperimentResults(experiment.id);
    expect(results.totalVisitors).toBe(20);
    expect(results.significant).toBe(false);
    expect(results.readiness).toMatch(/visitors per variant/i);
  });

  it("declares significance when the effect is large and the sample is adequate", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Strong effect", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "A" } },
        { name: "B", weight: 50, changes: { headline: "B" } },
      ],
    });
    await setExperimentStatus(ctx, experiment.id, "RUNNING");
    const [control, challenger] = experiment.variants;

    const impressions = [];
    const conversions = [];
    for (let i = 0; i < 400; i++) {
      impressions.push(
        { experimentId: experiment.id, variantId: control.id, sessionId: `big-a-${i}`, type: "impression" },
        { experimentId: experiment.id, variantId: challenger.id, sessionId: `big-b-${i}`, type: "impression" },
      );
      // 3% control vs 12% challenger.
      if (i % 33 === 0) {
        conversions.push({ experimentId: experiment.id, variantId: control.id, sessionId: `big-a-${i}`, type: "conversion", value: 40 });
      }
      if (i % 8 === 0) {
        conversions.push({ experimentId: experiment.id, variantId: challenger.id, sessionId: `big-b-${i}`, type: "conversion", value: 40 });
      }
    }
    await testDb.experimentEvent.createMany({ data: impressions, skipDuplicates: true });
    await testDb.experimentEvent.createMany({ data: conversions, skipDuplicates: true });

    const results = await getExperimentResults(experiment.id);
    expect(results.leader?.name).toBe("B");
    expect(results.significant).toBe(true);
    expect(results.leader?.upliftVsControl).toBeGreaterThan(100);
    expect(results.variants[1].pValue).toBeLessThan(0.05);
    expect(results.variants[1].revenuePerVisitor).toBeGreaterThan(0);
  });

  it("counts one impression and one conversion per session", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Dedupe", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "A" } },
        { name: "B", weight: 50, changes: { headline: "B" } },
      ],
    });
    const [control] = experiment.variants;

    for (let i = 0; i < 5; i++) {
      await recordExperimentEvent({
        experimentId: experiment.id, variantId: control.id,
        sessionId: "repeat-session", type: "impression",
      });
    }
    const results = await getExperimentResults(experiment.id);
    expect(results.variants.find((v) => v.id === control.id)?.visitors).toBe(1);
  });

  it("records conversions for sessions that saw the experiment", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Goal wiring", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 100, changes: { headline: "A" } },
        { name: "B", weight: 0, changes: { headline: "B" } },
      ],
    });
    await setExperimentStatus(ctx, experiment.id, "RUNNING");
    const [control] = experiment.variants;

    await recordExperimentEvent({
      experimentId: experiment.id, variantId: control.id,
      sessionId: "converting-session", type: "impression",
    });
    await recordConversions(ctx.storeId, "converting-session", "purchase", { value: 120 });

    const results = await getExperimentResults(experiment.id);
    const arm = results.variants.find((variant) => variant.id === control.id)!;
    expect(arm.conversions).toBe(1);
    expect(arm.revenue).toBe(120);

    // A session that never saw the test records nothing.
    await recordConversions(ctx.storeId, "unseen-session", "purchase", { value: 99 });
    const after = await getExperimentResults(experiment.id);
    expect(after.totalConversions).toBe(1);
  });
});

describe("choosing a winner", () => {
  it("writes the winning copy onto the live section", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Apply winner", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "Old headline" } },
        { name: "B", weight: 50, changes: { headline: "New winning headline" } },
      ],
    });
    await setExperimentStatus(ctx, experiment.id, "RUNNING");
    const challenger = experiment.variants.find((variant) => variant.name === "B")!;

    const result = await chooseWinner(ctx, experiment.id, challenger.id, true);
    expect(result.applied).toBe(true);

    const section = await testDb.pageSection.findUniqueOrThrow({ where: { id: sectionId } });
    expect((section.config as Record<string, unknown>).headline).toBe("New winning headline");

    const updated = await testDb.experiment.findUniqueOrThrow({ where: { id: experiment.id } });
    expect(updated.status).toBe("COMPLETED");
    expect(updated.winnerVariantId).toBe(challenger.id);
  });
});

describe("assignments supplied by an untrusted client", () => {
  it("only accepts variants that belong to a running experiment in the same store", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Tenant scoping", testType: "headline", targetType: "page", pageId, sectionId, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "A" } },
        { name: "B", weight: 50, changes: { headline: "B" } },
      ],
    });
    await setExperimentStatus(ctx, experiment.id, "RUNNING");
    const [control, challenger] = experiment.variants;

    // A second tenant, to stand in for the attacker's own store.
    const other = await createTestStore("experiments-other");
    const otherPage = await ensureHomepage(testDb, other.ctx.storeId);
    const otherSection = await testDb.pageSection.findFirstOrThrow({
      where: { pageId: otherPage.id, type: "hero" },
    });
    const foreign = await createExperiment(other.ctx, {
      name: "Someone else's test", testType: "headline", targetType: "page",
      pageId: otherPage.id, sectionId: otherSection.id, goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "A" } },
        { name: "B", weight: 50, changes: { headline: "B" } },
      ],
    });
    await setExperimentStatus(other.ctx, foreign.id, "RUNNING");

    const valid = { experimentId: experiment.id, variantId: challenger.id };

    // Genuine assignment survives.
    expect(await filterValidAssignments(ctx.storeId, [valid])).toEqual([valid]);

    // Another store's experiment is rejected.
    expect(
      await filterValidAssignments(ctx.storeId, [
        { experimentId: foreign.id, variantId: foreign.variants[0].id },
      ]),
    ).toEqual([]);

    // A variant paired with an experiment it does not belong to is rejected.
    expect(
      await filterValidAssignments(ctx.storeId, [
        { experimentId: experiment.id, variantId: foreign.variants[0].id },
      ]),
    ).toEqual([]);

    // Invented ids are rejected.
    expect(
      await filterValidAssignments(ctx.storeId, [
        { experimentId: experiment.id, variantId: "does-not-exist" },
      ]),
    ).toEqual([]);

    // A paused experiment stops accepting impressions.
    await setExperimentStatus(ctx, experiment.id, "PAUSED");
    expect(await filterValidAssignments(ctx.storeId, [valid])).toEqual([]);
    await setExperimentStatus(ctx, experiment.id, "RUNNING");

    // The control variant of the same running experiment is still fine.
    expect(
      await filterValidAssignments(ctx.storeId, [
        { experimentId: experiment.id, variantId: control.id },
      ]),
    ).toHaveLength(1);

    await cleanupTestStore(other.organization.id, other.user.id);
  });
});
