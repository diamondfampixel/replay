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
const createSpy = vi.fn(async (request: MockRequest) => (void request, responses.shift()) ?? { content: [{ type: "text", text: "" }] });

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return {
    ...actual,
    createAnthropic: () => ({ messages: { create: createSpy } }),
  };
});

vi.mock("@/lib/ai/config", () => ({
  DEFAULT_MODEL: "test-model",
  getAIConfig: async () => ({ apiKey: "test", model: "test-model", source: "environment" as const }),
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
  createSpy.mockClear();
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
