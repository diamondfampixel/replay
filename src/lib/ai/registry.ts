import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { ToolDefinition } from "@/lib/ai/types";
import { readTools } from "@/lib/ai/tools/read";
import { catalogTools } from "@/lib/ai/tools/catalog";
import { marketingTools } from "@/lib/ai/tools/marketing";
import { storefrontTools } from "@/lib/ai/tools/storefront";
import { operationsTools } from "@/lib/ai/tools/operations";
import { designTools } from "@/lib/ai/tools/design";
import { can, type Capability } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

export const TOOLS: ToolDefinition[] = [
  ...readTools,
  ...catalogTools,
  ...marketingTools,
  ...storefrontTools,
  ...designTools,
  ...operationsTools,
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function getTool(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** Internal helpers exist to power undo; the model is never offered them. */
const HIDDEN_FROM_MODEL = new Set(["restore_prices", "restore_product_statuses"]);

export function toolsForRole(role: Role): ToolDefinition[] {
  return TOOLS.filter(
    (tool) => !HIDDEN_FROM_MODEL.has(tool.name) && can(role, tool.capability as Capability),
  );
}

/** Converts the registry into the Anthropic tool-use schema. */
export function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((tool) => {
    const jsonSchema = z.toJSONSchema(tool.schema, { io: "input", target: "draft-7" }) as Record<string, unknown>;
    return {
      name: tool.name,
      description:
        tool.risk === "high"
          ? `${tool.description}\n\n(This action requires the operator to confirm before it runs.)`
          : tool.description,
      input_schema: {
        type: "object",
        properties: (jsonSchema.properties ?? {}) as Record<string, unknown>,
        required: (jsonSchema.required ?? []) as string[],
        additionalProperties: false,
      } as Anthropic.Tool.InputSchema,
    };
  });
}
