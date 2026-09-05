import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore } from "./helpers";
import { ROLE_CAPABILITIES, can, assertCan, AuthorizationError, CAPABILITIES } from "@/lib/permissions";
import { listIntegrations, connectIntegration } from "@/lib/services/integrations";
import { toolsForRole } from "@/lib/ai/registry";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import type { ServiceContext } from "@/lib/services/context";
import type { Role } from "@/generated/prisma/client";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;

beforeAll(async () => {
  const setup = await createTestStore("permissions");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("role capabilities", () => {
  it("gives the owner everything", () => {
    for (const capability of CAPABILITIES) {
      expect(can("OWNER", capability)).toBe(true);
    }
  });

  it("keeps billing away from admins", () => {
    expect(can("ADMIN", "billing:manage")).toBe(false);
    expect(can("ADMIN", "catalog:write")).toBe(true);
  });

  it("makes the analyst read-only", () => {
    const writes = ROLE_CAPABILITIES.ANALYST.filter(
      (capability) => capability.endsWith(":write") || capability.endsWith(":manage"),
    );
    expect(writes).toHaveLength(0);
    expect(can("ANALYST", "analytics:read")).toBe(true);
  });

  it("scopes marketing away from orders and payments", () => {
    expect(can("MARKETING", "marketing:write")).toBe(true);
    expect(can("MARKETING", "content:write")).toBe(true);
    expect(can("MARKETING", "orders:write")).toBe(false);
    expect(can("MARKETING", "settings:write")).toBe(false);
    expect(can("MARKETING", "billing:manage")).toBe(false);
  });

  it("scopes support to orders and customers", () => {
    expect(can("SUPPORT", "orders:write")).toBe(true);
    expect(can("SUPPORT", "customers:write")).toBe(true);
    expect(can("SUPPORT", "catalog:write")).toBe(false);
    expect(can("SUPPORT", "marketing:write")).toBe(false);
  });

  it("throws a typed error when a capability is missing", () => {
    expect(() => assertCan("ANALYST", "catalog:write")).toThrow(AuthorizationError);
    expect(() => assertCan("OWNER", "catalog:write")).not.toThrow();
  });

  it("filters the AI tool surface to match the role", () => {
    const roles: Role[] = ["OWNER", "ADMIN", "MARKETING", "SUPPORT", "ANALYST"];
    const counts = roles.map((role) => toolsForRole(role).length);
    // Every role gets at least the read tools, and none exceeds the owner.
    for (const count of counts) {
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(counts[0]);
    }
    expect(toolsForRole("ANALYST").length).toBeLessThan(toolsForRole("OWNER").length);
    expect(toolsForRole("SUPPORT").map((tool) => tool.name)).toContain("refund_order");
    expect(toolsForRole("MARKETING").map((tool) => tool.name)).not.toContain("refund_order");
  });
});

describe("integrations", () => {
  it("lists every catalog entry as not configured on a fresh store", async () => {
    const integrations = await listIntegrations(ctx);
    expect(integrations).toHaveLength(INTEGRATION_CATALOG.length);
    // Anthropic/Resend/Stripe may be connected via env in some environments.
    const uncontaminated = integrations.filter((integration) => !integration.fromEnvironment);
    expect(uncontaminated.every((integration) => integration.status === "NOT_CONFIGURED")).toBe(true);
  });

  it("refuses to connect a connector that is not implemented", async () => {
    await expect(
      connectIntegration(ctx, "printful", { apiKey: "whatever" }),
    ).rejects.toThrow(/not implemented yet/i);

    const integrations = await listIntegrations(ctx);
    const printful = integrations.find((integration) => integration.provider === "printful");
    // It is recorded as an error, never as connected.
    expect(printful?.status).not.toBe("CONNECTED");
  });

  it("requires every non-optional field", async () => {
    await expect(connectIntegration(ctx, "stripe", {})).rejects.toThrow(/required/i);
  });

  it("validates webhook connectors without a network call", async () => {
    await expect(
      connectIntegration(ctx, "slack", { webhookUrl: "not-a-url" }),
    ).rejects.toThrow(/not a valid url/i);

    await expect(
      connectIntegration(ctx, "slack", { webhookUrl: "http://insecure.example.com/hook" }),
    ).rejects.toThrow(/https/i);

    const result = await connectIntegration(ctx, "slack", {
      webhookUrl: "https://hooks.slack.com/services/ABC/DEF",
    });
    expect(result.label).toContain("hooks.slack.com");

    const integrations = await listIntegrations(ctx);
    expect(integrations.find((integration) => integration.provider === "slack")?.status).toBe("CONNECTED");
  });

  it("never returns a stored secret to the caller", async () => {
    const secretPath = "/services/T00000/B11111/xxxxSECRETxxxx";
    await connectIntegration(ctx, "discord", { webhookUrl: `https://discord.com/api/webhooks${secretPath}` });

    const integrations = await listIntegrations(ctx);
    const discord = integrations.find((integration) => integration.provider === "discord");
    expect(discord?.status).toBe("CONNECTED");
    // Only key names come back, never the value itself.
    expect(discord?.configuredKeys).toContain("webhookUrl");
    expect(JSON.stringify(discord)).not.toContain("xxxxSECRETxxxx");
  });

  it("lets any role see what is connected but only some change it", async () => {
    // Reading is deliberately open — knowing Stripe is connected is not sensitive.
    await expect(listIntegrations({ ...ctx, role: "SUPPORT" })).resolves.toBeTruthy();
    // Writing is not.
    await expect(
      connectIntegration({ ...ctx, role: "SUPPORT" }, "slack", { webhookUrl: "https://x.test/y" }),
    ).rejects.toThrow(AuthorizationError);
    await expect(
      connectIntegration({ ...ctx, role: "ANALYST" }, "slack", { webhookUrl: "https://x.test/y" }),
    ).rejects.toThrow(AuthorizationError);
  });
});
