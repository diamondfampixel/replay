import type { z } from "zod";
import type { Capability } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/services/context";

/**
 * Risk tiers.
 *
 *  read — no side effects; runs without asking.
 *  low  — creates or edits something reversible and clearly reported
 *         (a draft, an unpublished change).
 *  high — touches the live store, money, or deletes data. Always confirmed
 *         by a human before execution.
 */
export type ToolRisk = "read" | "low" | "high";

export type ToolResult = {
  /** Short sentence the model uses when telling the user what happened. */
  summary: string;
  /** Structured payload handed back to the model. */
  data?: unknown;
  /** Links surfaced in the chat transcript. */
  links?: Array<{ label: string; href: string }>;
  /** Snapshot enabling undo, when the operation is reversible. */
  undo?: { tool: string; params: Record<string, unknown> };
};

export type ConfirmationRequest = {
  title: string;
  description: string;
  /** Concrete facts the operator should read before approving. */
  details?: string[];
  confirmLabel?: string;
  destructive?: boolean;
};

export type ToolDefinition<Schema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  schema: Schema;
  risk: ToolRisk;
  capability: Capability;
  /**
   * Escalates a normally low-risk call to high risk for this particular input —
   * e.g. editing a draft product is routine, but changing the price of a live
   * one reaches shoppers immediately.
   */
  escalate?: (input: z.infer<Schema>, ctx: ServiceContext) => Promise<boolean>;
  /**
   * Builds the confirmation prompt for a high-risk call. Runs before execution
   * so the operator sees the real scope (e.g. how many products are affected).
   */
  confirm?: (input: z.infer<Schema>, ctx: ServiceContext) => Promise<ConfirmationRequest>;
  execute: (input: z.infer<Schema>, ctx: ServiceContext) => Promise<ToolResult>;
};

export function defineTool<Schema extends z.ZodType>(
  definition: ToolDefinition<Schema>,
): ToolDefinition<z.ZodType> {
  return definition as unknown as ToolDefinition<z.ZodType>;
}
