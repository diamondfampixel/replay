import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { ensureHomepage } from "@/lib/services/provision";
import { createProduct } from "@/lib/services/products";
import type { ServiceContext } from "@/lib/services/context";

/**
 * Exercises the chat route's tool-calling loop with the Anthropic SDK mocked,
 * so the orchestration (tool execution, result feeding, confirmation halting,
 * transcript persistence) is verified without a network call or an API key.
 */

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let productId: string;

const responses: Array<{ content: unknown[] }> = [];
type MockRequest = { messages: Array<{ role: string; content: unknown }> };
const mockUsage = { input_tokens: 900, output_tokens: 120, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const defaultImplementation = async (request: MockRequest) => {
  void request;
  const next = responses.shift() ?? { content: [{ type: "text", text: "" }] };
  return { usage: mockUsage, ...next };
};
const createSpy = vi.fn(defaultImplementation);

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return {
    ...actual,
    createAnthropic: () => ({ messages: { create: createSpy } }),
  };
});

vi.mock("@/lib/ai/config", () => ({
  DEFAULT_MODEL: "claude-sonnet-5",
  getAIConfig: async () => ({ apiKey: "test", model: "claude-sonnet-5", source: "environment" as const }),
  isAIConfigured: async () => true,
}));

vi.mock("@/lib/services/context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/context")>("@/lib/services/context");
  return {
    ...actual,
    serviceContext: async () => ctx,
    apiContext: async () => ctx,
  };
});

async function readStream(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const event = chunk.split("\n").find((line) => line.startsWith("event: "))?.slice(7).trim();
      const data = chunk.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
      return { event, data: data ? JSON.parse(data) : null };
    });
}

async function post(message: string) {
  const { POST } = await import("@/app/api/ai/chat/route");
  return POST(
    new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }),
  );
}

beforeAll(async () => {
  const setup = await createTestStore("ai-loop");
  ctx = { ...setup.ctx, actor: "ai" };
  organizationId = setup.organization.id;
  userId = setup.user.id;
  await ensureHomepage(testDb, ctx.storeId);
  const product = await createProduct(ctx, { title: "Loop Product", price: 40, status: "ACTIVE" });
  productId = product.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

beforeEach(() => {
  responses.length = 0;
  // Reset implementations too: a test that installs a permanent mock (the
  // round-limit test) must not leak into the ones after it.
  createSpy.mockReset();
  createSpy.mockImplementation(defaultImplementation);
});

describe("chat loop", () => {
  it("streams plain text when no tool is called", async () => {
    responses.push({ content: [{ type: "text", text: "Your store looks healthy." }] });

    const events = await readStream(await post("How are things?"));
    expect(events.map((event) => event.event)).toEqual(["start", "text", "done"]);
    expect(events[1].data.text).toBe("Your store looks healthy.");
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("executes a read tool and feeds the result back to the model", async () => {
    responses.push({
      content: [
        { type: "text", text: "Let me check." },
        { type: "tool_use", id: "tu_1", name: "list_products", input: { limit: 5 } },
      ],
    });
    responses.push({ content: [{ type: "text", text: "You have products." }] });

    const events = await readStream(await post("What products do I have?"));
    const kinds = events.map((event) => event.event);
    expect(kinds).toContain("tool_start");
    expect(kinds).toContain("tool_result");

    const result = events.find((event) => event.event === "tool_result")!;
    expect(result.data.status).toBe("executed");
    expect(result.data.name).toBe("list_products");

    // Second call carries the assistant turn plus the tool_result turn.
    expect(createSpy).toHaveBeenCalledTimes(2);
    const secondCall = createSpy.mock.calls[1][0];
    const lastMessage = secondCall.messages.at(-1)!;
    expect(lastMessage.role).toBe("user");
    expect(JSON.stringify(lastMessage.content)).toContain("tool_result");
  });

  it("halts on a high-impact tool and emits a confirmation", async () => {
    responses.push({
      content: [
        { type: "tool_use", id: "tu_2", name: "adjust_prices", input: { scope: "all", changeType: "percent", value: -25 } },
      ],
    });
    responses.push({ content: [{ type: "text", text: "I need your approval first." }] });

    const events = await readStream(await post("Cut all prices by 25%"));
    const confirmation = events.find((event) => event.event === "confirmation_required");
    expect(confirmation).toBeTruthy();
    expect(confirmation!.data.title).toMatch(/change prices/i);
    expect(confirmation!.data.actionId).toBeTruthy();

    // The price is untouched until the operator approves.
    const product = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(product.price)).toBe(40);

    const action = await testDb.aIAction.findUniqueOrThrow({
      where: { id: confirmation!.data.actionId },
    });
    expect(action.status).toBe("PENDING_CONFIRMATION");
  });

  it("reports a failing tool without aborting the turn", async () => {
    responses.push({
      content: [{ type: "tool_use", id: "tu_3", name: "get_product", input: { productId: "nope" } }],
    });
    responses.push({ content: [{ type: "text", text: "I could not find that product." }] });

    const events = await readStream(await post("Show me product nope"));
    const result = events.find((event) => event.event === "tool_result")!;
    expect(result.data.status).toBe("failed");
    expect(result.data.error).toBeTruthy();
    expect(events.some((event) => event.event === "done")).toBe(true);
  });

  it("persists the transcript with its tool calls", async () => {
    responses.push({
      content: [{ type: "tool_use", id: "tu_4", name: "get_store_overview", input: { range: "7d" } }],
    });
    responses.push({ content: [{ type: "text", text: "Here is the week." }] });

    const events = await readStream(await post("How was this week?"));
    const conversationId = events[0].data.conversationId as string;

    const messages = await testDb.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    const assistant = messages.filter((message) => message.role === "assistant").at(-1)!;
    expect(assistant.content).toContain("Here is the week.");

    const calls = assistant.toolCalls as Array<{ name: string; status: string }>;
    expect(calls[0].name).toBe("get_store_overview");
    expect(calls[0].status).toBe("executed");

    const conversation = await testDb.aIConversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conversation.title).toBe("How was this week?");
  });

  it("surfaces a provider failure without losing the conversation", async () => {
    createSpy.mockImplementationOnce(async () => {
      throw new Error("upstream is unavailable: key sk-ant-secret rejected");
    });

    const events = await readStream(await post("Anything happening?"));
    const error = events.find((event) => event.event === "error");

    // The operator is told the request failed, but the upstream text is not
    // relayed — it can quote the request body or the key that produced it.
    expect(error).toBeDefined();
    expect(error?.data.error).toMatch(/could not complete that request/i);
    expect(JSON.stringify(error?.data)).not.toMatch(/sk-ant-secret/);

    // The turn is still recorded rather than silently dropped.
    const conversation = await testDb.aIConversation.findFirst({
      where: { storeId: ctx.storeId },
      orderBy: { updatedAt: "desc" },
    });
    expect(conversation).not.toBeNull();
  });

  it("maps a rejected API key to actionable text without echoing the provider body", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    createSpy.mockImplementationOnce(async () => {
      throw new Anthropic.AuthenticationError(
        401,
        { error: { message: "invalid x-api-key sk-ant-secret" } },
        "unauthorized",
        new Headers(),
      );
    });

    const events = await readStream(await post("Anything happening?"));
    const error = events.find((event) => event.event === "error");
    expect(error?.data.error).toMatch(/API key was rejected/i);
    expect(JSON.stringify(error?.data)).not.toMatch(/sk-ant-secret/);
  });

  it("stops after the round limit rather than looping forever", async () => {
    // Always ask for another tool call; the loop must bound itself.
    createSpy.mockImplementation(async () => ({
      content: [{ type: "tool_use", id: `tu_${Math.random()}`, name: "list_products", input: {} }],
    }) as never);

    await readStream(await post("Keep going"));
    expect(createSpy.mock.calls.length).toBeLessThanOrEqual(8);
  });
});

describe("model routing", () => {
  it("serves a read-only question with the light model and no effort setting", async () => {
    responses.push({ content: [{ type: "text", text: "Here is the breakdown." }] });
    await readStream(await post("Give me a breakdown of my recent sales."));
    const request = createSpy.mock.calls[0][0] as unknown as { model: string; output_config?: unknown };
    expect(request.model).toBe("claude-haiku-4-5");
    expect(request.output_config).toBeUndefined();
  });

  it("serves a store change with the default model at medium effort", async () => {
    responses.push({ content: [{ type: "text", text: "Done." }] });
    await readStream(await post("Create a 10% discount code WELCOME10"));
    const request = createSpy.mock.calls[0][0] as unknown as { model: string; output_config?: { effort: string } };
    expect(request.model).toBe("claude-sonnet-5");
    expect(request.output_config).toEqual({ effort: "medium" });
  });

  it("escalates to the default model once the light model reaches for a write tool", async () => {
    responses.push({
      content: [{ type: "tool_use", id: "tu_esc", name: "adjust_prices", input: { scope: "all", changeType: "percent", value: -5 } }],
    });
    responses.push({ content: [{ type: "text", text: "Awaiting approval." }] });
    await readStream(await post("What about five percent off everything?"));
    const first = createSpy.mock.calls[0][0] as unknown as { model: string };
    const second = createSpy.mock.calls[1][0] as unknown as { model: string };
    expect(first.model).toBe("claude-haiku-4-5");
    expect(second.model).toBe("claude-sonnet-5");
  });

  it("falls back to the default model when the light model is unavailable to the key", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    createSpy.mockImplementationOnce(async () => {
      throw new Anthropic.NotFoundError(404, { error: { message: "model not found" } }, "not found", new Headers());
    });
    responses.push({ content: [{ type: "text", text: "Fallback answered." }] });
    const events = await readStream(await post("How many orders this week?"));
    expect(events.find((event) => event.event === "text")?.data.text).toBe("Fallback answered.");
    expect((createSpy.mock.calls[1][0] as unknown as { model: string }).model).toBe("claude-sonnet-5");
  });
});

describe("spend safeguards and the ledger", () => {
  it("charges one visible action per message however many model calls it took, and records the request", async () => {
    const before = await testDb.aIUsageDay.aggregate({ where: { organizationId }, _sum: { actions: true } });
    responses.push({
      content: [
        { type: "tool_use", id: "tu_a", name: "get_store_overview", input: {} },
        { type: "tool_use", id: "tu_b", name: "get_top_products", input: { limit: 3 } },
      ],
    });
    responses.push({ content: [{ type: "tool_use", id: "tu_c", name: "get_inventory_status", input: {} }] });
    responses.push({ content: [{ type: "text", text: "Three tools, one answer." }] });

    await readStream(await post("Best sellers and anything low on stock?"));
    expect(createSpy).toHaveBeenCalledTimes(3);

    const after = await testDb.aIUsageDay.aggregate({ where: { organizationId }, _sum: { actions: true } });
    expect((after._sum.actions ?? 0) - (before._sum.actions ?? 0)).toBe(1);

    const ledger = await testDb.aIRequest.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
    expect(ledger?.kind).toBe("chat_read");
    expect(ledger?.tier).toBe("light");
    expect(ledger?.modelCalls).toBe(3);
    expect(ledger?.toolCalls).toBe(3);
    expect(ledger?.status).toBe("ok");
    expect(ledger?.outputTokens).toBe(360);
    expect(ledger?.estimatedCostMicros).toBeGreaterThan(0);
    expect(ledger?.plan).toBe("flagship");
  });

  it("stops a model that keeps repeating the identical tool call", async () => {
    for (let i = 0; i < 6; i++) {
      responses.push({ content: [{ type: "tool_use", id: `tu_rep_${i}`, name: "list_products", input: { limit: 2 } }] });
    }
    const events = await readStream(await post("List two products, again and again"));
    const error = events.find((event) => event.event === "error");
    expect(error?.data.error).toMatch(/repeating/i);
    // Two identical calls run; the third, fourth and fifth are refused; then it stops.
    expect(events.filter((event) => event.event === "tool_start")).toHaveLength(2);
    expect(createSpy.mock.calls.length).toBe(5);

    const ledger = await testDb.aIRequest.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
    expect(ledger?.status).toBe("guard");
    expect(ledger?.guard).toBe("tool_loop");
  });

  it("stops a request whose estimated spend passes the per-request ceiling", async () => {
    process.env.AI_REQUEST_SPEND_CEILING_USD = "0.000001";
    try {
      responses.push({ content: [{ type: "tool_use", id: "tu_big", name: "list_products", input: {} }] });
      responses.push({ content: [{ type: "text", text: "never reached" }] });
      const events = await readStream(await post("What products do I have?"));
      expect(events.find((event) => event.event === "error")?.data.error).toMatch(/larger than the assistant allows/i);
      expect(createSpy).toHaveBeenCalledTimes(1);
      const ledger = await testDb.aIRequest.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
      expect(ledger?.guard).toBe("request_spend");
    } finally {
      delete process.env.AI_REQUEST_SPEND_CEILING_USD;
    }
  });

  it("refuses before any model call once the allowance is spent, and the plan's own limits decide", async () => {
    await testDb.organization.update({ where: { id: organizationId }, data: { plan: "harbor" } });
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    await testDb.aIUsageDay.create({
      data: { organizationId, day: new Date(Date.UTC(2026, 0, 3)), actions: 25 },
    });
    try {
      const response = await post("Anything?");
      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.code).toBe("AI_BUDGET");
      expect(body.error).toMatch(/25/);
      expect(createSpy).not.toHaveBeenCalled();
    } finally {
      await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
      await testDb.organization.update({ where: { id: organizationId }, data: { plan: "flagship" } });
    }
  });

  it("pauses at the internal spend ceiling even with actions left, without naming a price", async () => {
    await testDb.aIUsageDay.create({
      data: { organizationId, day: new Date(Date.UTC(2026, 8, 1)), actions: 3, estimatedCostMicros: 60_000_000 },
    });
    try {
      const response = await post("Anything?");
      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toMatch(/usage limit/i);
      expect(body.error).not.toMatch(/\$/);
      expect(createSpy).not.toHaveBeenCalled();
    } finally {
      await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    }
  });
});
