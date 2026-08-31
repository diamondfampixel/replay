import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTool } from "@/lib/ai/registry";
import type { ConfirmationRequest, ToolResult, ToolRisk } from "@/lib/ai/types";
import { AuthorizationError, can, type Capability } from "@/lib/permissions";
import { audit, type ServiceContext } from "@/lib/services/context";

export type ExecutionOutcome =
  | { status: "executed"; result: ToolResult; actionId: string; risk: ToolRisk }
  | { status: "needs_confirmation"; confirmation: ConfirmationRequest; actionId: string; risk: ToolRisk }
  | { status: "failed"; error: string; actionId: string | null };

export type ExecuteOptions = {
  /** Set once the operator has approved a high-impact action. */
  confirmed?: boolean;
  conversationId?: string;
  prompt?: string;
};

/**
 * Runs one tool call.
 *
 * Every call is validated against the tool's Zod schema, checked against the
 * caller's role, and written to the AIAction log — whether it succeeds, fails,
 * or stops to ask for confirmation. Nothing here trusts the model's input.
 */
export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ServiceContext,
  options: ExecuteOptions = {},
): Promise<ExecutionOutcome> {
  const tool = getTool(name);
  if (!tool) {
    return { status: "failed", error: `Unknown tool "${name}".`, actionId: null };
  }

  if (!can(ctx.role, tool.capability as Capability)) {
    const error = `Your role does not allow "${tool.capability}", so ${name} cannot run.`;
    await logAction(ctx, options, name, rawInput, "FAILED", tool.risk, { error });
    return { status: "failed", error, actionId: null };
  }

  let input: unknown;
  try {
    input = tool.schema.parse(rawInput ?? {});
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? `Invalid arguments for ${name}: ${error.issues.map((issue) => `${issue.path.join(".") || "input"} — ${issue.message}`).join("; ")}`
        : `Invalid arguments for ${name}.`;
    await logAction(ctx, options, name, rawInput, "FAILED", tool.risk, { error: message });
    return { status: "failed", error: message, actionId: null };
  }

  // A normally low-risk call can escalate based on what it would actually do.
  let risk: ToolRisk = tool.risk;
  if (risk !== "high" && tool.escalate) {
    try {
      if (await tool.escalate(input, ctx)) risk = "high";
    } catch {
      // If we cannot decide, err toward asking.
      risk = "high";
    }
  }

  if (risk === "high" && !options.confirmed) {
    let confirmation: ConfirmationRequest;
    try {
      confirmation = tool.confirm
        ? await tool.confirm(input, ctx)
        : {
            title: `Run ${name}?`,
            description: "This action changes your live store.",
            confirmLabel: "Continue",
          };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not prepare this action.";
      await logAction(ctx, options, name, input, "FAILED", risk, { error: message });
      return { status: "failed", error: message, actionId: null };
    }

    const action = await logAction(ctx, options, name, input, "PENDING_CONFIRMATION", risk);
    return { status: "needs_confirmation", confirmation, actionId: action.id, risk };
  }

  try {
    const result = await tool.execute(input, ctx);
    const action = await logAction(ctx, options, name, input, "EXECUTED", risk, {
      result: { summary: result.summary, data: result.data },
      undo: result.undo,
    });
    return { status: "executed", result, actionId: action.id, risk };
  } catch (error) {
    const message =
      error instanceof AuthorizationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The action failed.";
    const action = await logAction(ctx, options, name, input, "FAILED", risk, { error: message });

    await prisma.notification
      .create({
        data: {
          storeId: ctx.storeId,
          type: "ai_action_failed",
          title: `AI action failed: ${name}`,
          body: message.slice(0, 240),
          href: "/admin/activity",
        },
      })
      .catch(() => undefined);

    return { status: "failed", error: message, actionId: action.id };
  }
}

async function logAction(
  ctx: ServiceContext,
  options: ExecuteOptions,
  tool: string,
  params: unknown,
  status: "EXECUTED" | "FAILED" | "PENDING_CONFIRMATION" | "CANCELLED",
  risk: ToolRisk,
  extra: { result?: unknown; error?: string; undo?: unknown } = {},
) {
  const action = await prisma.aIAction.create({
    data: {
      storeId: ctx.storeId,
      conversationId: options.conversationId ?? null,
      userId: ctx.userId,
      prompt: options.prompt?.slice(0, 2000) ?? null,
      tool,
      params: (params ?? {}) as object,
      result: (extra.result ?? undefined) as object | undefined,
      status,
      riskLevel: risk,
      error: extra.error ?? null,
      undoData: (extra.undo ?? undefined) as object | undefined,
    },
  });

  if (status === "EXECUTED" && risk !== "read") {
    await audit(
      { ...ctx, actor: "ai" },
      `ai.${tool}`,
      { type: "AIAction", id: action.id },
      { prompt: options.prompt?.slice(0, 200) },
    );
  }
  return action;
}

/** Executes a previously logged pending action after the operator confirms it. */
export async function confirmPendingAction(actionId: string, ctx: ServiceContext) {
  const action = await prisma.aIAction.findFirst({
    where: { id: actionId, storeId: ctx.storeId },
  });
  if (!action) return { status: "failed" as const, error: "That pending action no longer exists.", actionId: null };
  if (action.status !== "PENDING_CONFIRMATION") {
    return { status: "failed" as const, error: "That action has already been handled.", actionId: null };
  }

  const outcome = await executeTool(action.tool, action.params, ctx, {
    confirmed: true,
    conversationId: action.conversationId ?? undefined,
    prompt: action.prompt ?? undefined,
  });

  await prisma.aIAction.update({
    where: { id: actionId },
    data: { status: outcome.status === "executed" ? "EXECUTED" : "FAILED" },
  });

  return outcome;
}

export async function cancelPendingAction(actionId: string, ctx: ServiceContext) {
  await prisma.aIAction.updateMany({
    where: { id: actionId, storeId: ctx.storeId, status: "PENDING_CONFIRMATION" },
    data: { status: "CANCELLED" },
  });
}

/** Reverses a logged action using the snapshot captured at execution time. */
export async function undoAction(actionId: string, ctx: ServiceContext) {
  const action = await prisma.aIAction.findFirst({ where: { id: actionId, storeId: ctx.storeId } });
  if (!action) throw new Error("That action no longer exists.");
  if (action.status !== "EXECUTED") throw new Error("Only completed actions can be undone.");
  if (action.undoneAt) throw new Error("That action has already been undone.");

  const undo = action.undoData as { tool: string; params: Record<string, unknown> } | null;
  if (!undo?.tool) throw new Error("This action cannot be undone automatically.");

  const outcome = await executeTool(undo.tool, undo.params, ctx, {
    confirmed: true,
    prompt: `Undo of ${action.tool}`,
  });
  if (outcome.status !== "executed") {
    throw new Error(outcome.status === "failed" ? outcome.error : "The undo could not be completed.");
  }

  await prisma.aIAction.update({
    where: { id: actionId },
    data: { status: "UNDONE", undoneAt: new Date() },
  });

  return outcome.result;
}
