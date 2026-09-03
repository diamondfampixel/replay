import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { appendMessage, getOrCreateConversation, markToolCallOutcome } from "@/lib/ai/conversation";
import type { ServiceContext } from "@/lib/services/context";

/**
 * When the operator approves or declines a queued action, the stored transcript
 * must record the outcome — otherwise the next model turn sees a "pending" tool
 * call and repeats it. This is the regression test for that loop.
 */
let ctx: ServiceContext; let organizationId: string; let userId: string;
beforeAll(async () => { const s = await createTestStore("confirm-history"); ctx = s.ctx; organizationId = s.organization.id; userId = s.user.id; });
afterAll(async () => { await cleanupTestStore(organizationId, userId); });

describe("approval outcomes are written back to the transcript", () => {
  it("marks the matching tool call executed / cancelled", async () => {
    const conversation = await getOrCreateConversation(ctx.storeId, ctx.userId!, null);
    const action = await testDb.aIAction.create({ data: { storeId: ctx.storeId, conversationId: conversation.id, tool: "set_store_design_direction", params: { direction: "bold" }, status: "PENDING_CONFIRMATION", riskLevel: "high" } });
    const other = await testDb.aIAction.create({ data: { storeId: ctx.storeId, conversationId: conversation.id, tool: "update_store_design", params: {}, status: "PENDING_CONFIRMATION", riskLevel: "high" } });
    await appendMessage(conversation.id, "assistant", "Queued two changes.", {
      toolCalls: [
        { id: "t1", name: "set_store_design_direction", input: {}, status: "pending", actionId: action.id },
        { id: "t2", name: "update_store_design", input: {}, status: "pending", actionId: other.id },
      ],
      pendingAction: [{ actionId: action.id, toolName: "set_store_design_direction", title: "x", description: "y" }, { actionId: other.id, toolName: "update_store_design", title: "x", description: "y" }],
    });
    expect(await markToolCallOutcome(action.id, { status: "executed", summary: "Storefront redesigned as Bold." })).toBe(true);
    expect(await markToolCallOutcome(other.id, { status: "cancelled", error: "Declined by the operator" })).toBe(true);
    const stored = await testDb.aIMessage.findFirstOrThrow({ where: { conversationId: conversation.id, role: "assistant" } });
    const calls = stored.toolCalls as Array<{ actionId: string; status: string; summary?: string; error?: string }>;
    expect(calls.find((c) => c.actionId === action.id)).toMatchObject({ status: "executed", summary: "Storefront redesigned as Bold." });
    expect(calls.find((c) => c.actionId === other.id)).toMatchObject({ status: "cancelled", error: "Declined by the operator" });
    expect(Array.isArray(stored.pendingAction)).toBe(true);
    expect(await markToolCallOutcome("nope", { status: "executed" })).toBe(false);
  });
});
