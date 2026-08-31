import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb, analystContext } from "./helpers";
import { executeTool, confirmPendingAction, cancelPendingAction, undoAction } from "@/lib/ai/executor";
import { TOOLS, toolsForRole, toAnthropicTools, getTool } from "@/lib/ai/registry";
import { createProduct } from "@/lib/services/products";
import { ensureHomepage } from "@/lib/services/provision";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let productId: string;

beforeAll(async () => {
  const setup = await createTestStore("ai");
  ctx = { ...setup.ctx, actor: "ai" };
  organizationId = setup.organization.id;
  userId = setup.user.id;

  await ensureHomepage(testDb, ctx.storeId);
  const product = await createProduct(ctx, {
    title: "AI Test Hoodie", price: 60, status: "ACTIVE", inventory: 20,
    description: "Original description.",
  });
  productId = product.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("tool registry", () => {
  it("exposes a unique, well-formed tool for every entry", () => {
    const names = TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of TOOLS) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(["read", "low", "high"]).toContain(tool.risk);
    }
  });

  it("produces valid Anthropic tool schemas", () => {
    const schemas = toAnthropicTools(TOOLS);
    expect(schemas.length).toBe(TOOLS.length);
    for (const schema of schemas) {
      expect(schema.input_schema.type).toBe("object");
      expect(schema.input_schema).toHaveProperty("properties");
    }
  });

  it("filters the tool list by role", () => {
    const analystTools = toolsForRole("ANALYST").map((tool) => tool.name);
    expect(analystTools).toContain("get_store_overview");
    expect(analystTools).not.toContain("create_product");
    expect(analystTools).not.toContain("adjust_prices");

    const ownerTools = toolsForRole("OWNER").map((tool) => tool.name);
    expect(ownerTools).toContain("adjust_prices");
  });

  it("hides internal undo helpers from the model", () => {
    const names = toolsForRole("OWNER").map((tool) => tool.name);
    expect(names).not.toContain("restore_prices");
    // But they remain executable internally.
    expect(getTool("restore_prices")).toBeTruthy();
  });
});

describe("validation and authorization", () => {
  it("rejects an unknown tool", async () => {
    const outcome = await executeTool("not_a_tool", {}, ctx);
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") expect(outcome.error).toMatch(/unknown tool/i);
  });

  it("rejects arguments that fail the schema", async () => {
    const outcome = await executeTool("create_product", { title: "", price: -1 }, ctx);
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") expect(outcome.error).toMatch(/invalid arguments/i);
  });

  it("refuses a tool the caller's role does not allow", async () => {
    const outcome = await executeTool("create_product", { title: "Blocked", price: 10 }, analystContext(ctx));
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") expect(outcome.error).toMatch(/does not allow/i);
  });

  it("still allows read tools for a read-only role", async () => {
    const outcome = await executeTool("get_store_overview", { range: "30d" }, analystContext(ctx));
    expect(outcome.status).toBe("executed");
  });
});

describe("risk classification", () => {
  it("runs read tools without confirmation", async () => {
    const outcome = await executeTool("list_products", {}, ctx);
    expect(outcome.status).toBe("executed");
    if (outcome.status === "executed") expect(outcome.risk).toBe("read");
  });

  it("runs low-risk writes without confirmation", async () => {
    const outcome = await executeTool(
      "create_product",
      { title: "Quiet Draft", price: 25 },
      ctx,
    );
    expect(outcome.status).toBe("executed");
    if (outcome.status === "executed") {
      expect(outcome.risk).toBe("low");
      expect(outcome.result.summary).toMatch(/draft/i);
    }
  });

  it("stops for confirmation before a bulk price change", async () => {
    const outcome = await executeTool(
      "adjust_prices",
      { scope: "all", changeType: "percent", value: -25 },
      ctx,
    );
    expect(outcome.status).toBe("needs_confirmation");
    if (outcome.status === "needs_confirmation") {
      expect(outcome.confirmation.title).toMatch(/change prices/i);
      expect(outcome.confirmation.description).toMatch(/live storefront/i);
      expect(outcome.confirmation.details?.length).toBeGreaterThan(0);
      expect(outcome.confirmation.destructive).toBe(true);
    }
  });

  it("escalates a price change on a live product but not on other fields", async () => {
    const descriptionChange = await executeTool(
      "update_product",
      { productId, description: "A new description." },
      ctx,
    );
    expect(descriptionChange.status).toBe("executed");

    const priceChange = await executeTool("update_product", { productId, price: 45 }, ctx);
    expect(priceChange.status).toBe("needs_confirmation");
  });

  it("stops before publishing products", async () => {
    const outcome = await executeTool(
      "set_product_status",
      { productIds: [productId], status: "ACTIVE" },
      ctx,
    );
    expect(outcome.status).toBe("needs_confirmation");
  });

  it("stops before deleting", async () => {
    const outcome = await executeTool("delete_products", { productIds: [productId] }, ctx);
    expect(outcome.status).toBe("needs_confirmation");
    if (outcome.status === "needs_confirmation") {
      expect(outcome.confirmation.destructive).toBe(true);
    }
    // Nothing was deleted.
    expect(await testDb.product.count({ where: { id: productId } })).toBe(1);
  });

  it("creates a discount as a draft freely but confirms activation", async () => {
    const draft = await executeTool(
      "create_discount",
      { title: "Quiet discount", code: "QUIET10", type: "PERCENTAGE", value: 10 },
      ctx,
    );
    expect(draft.status).toBe("executed");

    const live = await executeTool(
      "create_discount",
      { title: "Live discount", code: "LOUD20", type: "PERCENTAGE", value: 20, activate: true },
      ctx,
    );
    expect(live.status).toBe("needs_confirmation");
  });
});

describe("confirmation flow", () => {
  it("executes only after the operator approves", async () => {
    const pending = await executeTool(
      "adjust_prices",
      { scope: "products", productIds: [productId], changeType: "percent", value: -50 },
      ctx,
    );
    expect(pending.status).toBe("needs_confirmation");
    if (pending.status !== "needs_confirmation") return;

    const before = await testDb.product.findUniqueOrThrow({ where: { id: productId } });

    const confirmed = await confirmPendingAction(pending.actionId, ctx);
    expect(confirmed.status).toBe("executed");

    const after = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(after.price)).toBeCloseTo(Number(before.price) * 0.5, 2);
  });

  it("does nothing when the operator cancels", async () => {
    const before = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
    const pending = await executeTool(
      "adjust_prices",
      { scope: "products", productIds: [productId], changeType: "percent", value: -90 },
      ctx,
    );
    if (pending.status !== "needs_confirmation") throw new Error("expected confirmation");

    await cancelPendingAction(pending.actionId, ctx);
    const after = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(after.price)).toBe(Number(before.price));

    const action = await testDb.aIAction.findUniqueOrThrow({ where: { id: pending.actionId } });
    expect(action.status).toBe("CANCELLED");

    // A cancelled action cannot then be confirmed.
    const retry = await confirmPendingAction(pending.actionId, ctx);
    expect(retry.status).toBe("failed");
  });
});

describe("audit logging", () => {
  it("logs every call with its parameters and result", async () => {
    const outcome = await executeTool(
      "create_product",
      { title: "Logged Product", price: 15 },
      ctx,
      { prompt: "add a logged product" },
    );
    expect(outcome.status).toBe("executed");
    if (outcome.status !== "executed") return;

    const action = await testDb.aIAction.findUniqueOrThrow({ where: { id: outcome.actionId } });
    expect(action.tool).toBe("create_product");
    expect(action.status).toBe("EXECUTED");
    expect(action.prompt).toBe("add a logged product");
    expect((action.params as { title: string }).title).toBe("Logged Product");

    const audits = await testDb.auditLog.findMany({
      where: { organizationId, action: "ai.create_product" },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].actor).toBe("ai");
  });

  it("logs failures too", async () => {
    const outcome = await executeTool("get_product", { productId: "does-not-exist" }, ctx);
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed" || !outcome.actionId) return;

    const action = await testDb.aIAction.findUniqueOrThrow({ where: { id: outcome.actionId } });
    expect(action.status).toBe("FAILED");
    expect(action.error).toBeTruthy();
  });
});

describe("undo", () => {
  it("reverts a created product", async () => {
    const outcome = await executeTool("create_product", { title: "Undo Me", price: 30 }, ctx);
    if (outcome.status !== "executed") throw new Error("expected execution");
    const created = (outcome.result.data as { productId: string }).productId;

    expect(await testDb.product.count({ where: { id: created } })).toBe(1);
    await undoAction(outcome.actionId, ctx);
    expect(await testDb.product.count({ where: { id: created } })).toBe(0);

    const action = await testDb.aIAction.findUniqueOrThrow({ where: { id: outcome.actionId } });
    expect(action.status).toBe("UNDONE");
  });

  it("reverts a section change back to its previous copy", async () => {
    const page = await testDb.page.findFirstOrThrow({
      where: { storeId: ctx.storeId, type: "HOME" },
      include: { sections: true },
    });
    const hero = page.sections.find((section) => section.type === "hero")!;
    const originalHeadline = (hero.config as { headline: string }).headline;

    const pending = await executeTool(
      "update_store_section",
      { page: "homepage", sectionId: hero.id, config: { headline: "Free shipping. Better essentials." } },
      ctx,
    );
    if (pending.status !== "needs_confirmation") throw new Error("expected confirmation");

    const executed = await confirmPendingAction(pending.actionId, ctx);
    if (executed.status !== "executed") throw new Error("expected execution");

    let section = await testDb.pageSection.findUniqueOrThrow({ where: { id: hero.id } });
    expect((section.config as { headline: string }).headline).toBe("Free shipping. Better essentials.");

    await undoAction(executed.actionId, ctx);
    section = await testDb.pageSection.findUniqueOrThrow({ where: { id: hero.id } });
    expect((section.config as { headline: string }).headline).toBe(originalHeadline);
  });

  it("refuses to undo twice", async () => {
    const outcome = await executeTool("create_product", { title: "Undo Twice", price: 12 }, ctx);
    if (outcome.status !== "executed") throw new Error("expected execution");
    await undoAction(outcome.actionId, ctx);
    await expect(undoAction(outcome.actionId, ctx)).rejects.toThrow(/already been undone|completed actions/i);
  });
});

describe("tenant isolation", () => {
  it("cannot read another store's product through a tool", async () => {
    const other = await createTestStore("ai-isolation");
    const foreign = await createProduct(other.ctx, { title: "Foreign AI Product", price: 99 });

    const outcome = await executeTool("get_product", { productId: foreign.id }, ctx);
    expect(outcome.status).toBe("failed");

    await cleanupTestStore(other.organization.id, other.user.id);
  });
});

describe("one approval executes an action once", () => {
  /**
   * The confirm endpoint is the gate on irreversible business changes, so
   * single execution has to hold on the server rather than relying on the
   * button being disabled.
   */
  it("executes a bulk price change once even when two confirmations race", async () => {
    const product = await createProduct(ctx, {
      title: "Race Product",
      status: "ACTIVE",
      price: 100,
    });

    const pending = await executeTool(
      "adjust_prices",
      { scope: "all", changeType: "percent", value: -25 },
      ctx,
    );
    expect(pending.status).toBe("needs_confirmation");
    if (pending.status !== "needs_confirmation") return;

    const [first, second] = await Promise.all([
      confirmPendingAction(pending.actionId, ctx),
      confirmPendingAction(pending.actionId, ctx),
    ]);

    // Exactly one wins; the other is told it was already handled.
    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(["executed", "failed"]);

    const after = await testDb.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(Number(after.price)).toBeCloseTo(75, 2);

    const rows = await testDb.aIAction.findMany({ where: { id: pending.actionId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("EXECUTED");
  });

  it("refuses a second confirmation made after the first has finished", async () => {
    const pending = await executeTool(
      "adjust_prices",
      { scope: "all", changeType: "percent", value: -10 },
      ctx,
    );
    if (pending.status !== "needs_confirmation") throw new Error("expected confirmation");

    expect((await confirmPendingAction(pending.actionId, ctx)).status).toBe("executed");
    const replay = await confirmPendingAction(pending.actionId, ctx);
    expect(replay.status).toBe("failed");
    if (replay.status === "failed") expect(replay.error).toMatch(/already been handled/i);
  });

  it("will not confirm an action belonging to another store", async () => {
    const pending = await executeTool(
      "adjust_prices",
      { scope: "all", changeType: "percent", value: -5 },
      ctx,
    );
    if (pending.status !== "needs_confirmation") throw new Error("expected confirmation");

    const other = await createTestStore("ai-confirm-other");
    const result = await confirmPendingAction(pending.actionId, other.ctx);
    expect(result.status).toBe("failed");

    const row = await testDb.aIAction.findUniqueOrThrow({ where: { id: pending.actionId } });
    expect(row.status).toBe("PENDING_CONFIRMATION");

    await cancelPendingAction(pending.actionId, ctx);
    await cleanupTestStore(other.organization.id, other.user.id);
  });
});
