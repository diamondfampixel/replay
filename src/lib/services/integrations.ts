import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { audit, authorize, ValidationError, type ServiceContext } from "@/lib/services/context";
import { INTEGRATION_CATALOG, getIntegration } from "@/lib/integrations/catalog";
import { createCjProvider } from "@/lib/sourcing/providers/cjdropshipping";
import { SourcingError } from "@/lib/sourcing/types";

export type IntegrationView = {
  provider: string;
  status: "NOT_CONFIGURED" | "CONNECTED" | "ERROR" | "DISCONNECTED";
  accountLabel: string | null;
  connectedAt: Date | null;
  lastError: string | null;
  /** True when credentials come from the environment rather than the UI. */
  fromEnvironment: boolean;
  /** Which config keys have a stored value. Secrets themselves never leave the server. */
  configuredKeys: string[];
};

function mask(value: string) {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function listIntegrations(ctx: ServiceContext): Promise<IntegrationView[]> {
  authorize(ctx, "integrations:read");
  const rows = await prisma.integration.findMany({ where: { storeId: ctx.storeId } });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return INTEGRATION_CATALOG.map((definition) => {
    const row = byProvider.get(definition.id);
    const envValue = definition.envVar ? process.env[definition.envVar]?.trim() : undefined;
    const config = (row?.config ?? {}) as Record<string, string>;

    // An environment credential counts as connected without any stored config.
    const fromEnvironment = Boolean(envValue);
    const status = fromEnvironment
      ? ("CONNECTED" as const)
      : (row?.status ?? "NOT_CONFIGURED");

    return {
      provider: definition.id,
      status,
      accountLabel: fromEnvironment ? `From ${definition.envVar}` : row?.accountLabel ?? null,
      connectedAt: row?.connectedAt ?? null,
      lastError: row?.lastError ?? null,
      fromEnvironment,
      configuredKeys: Object.keys(config).filter((key) => Boolean(config[key])),
    };
  });
}

export async function getIntegrationView(ctx: ServiceContext, provider: string) {
  const all = await listIntegrations(ctx);
  return all.find((integration) => integration.provider === provider) ?? null;
}

type VerifyResult = { ok: true; label: string } | { ok: false; error: string };

/**
 * Validates credentials against the provider before storing them.
 *
 * Only connectors this codebase can actually talk to are verified live. A
 * "planned" connector refuses to connect rather than showing a green tick for
 * something that does nothing.
 */
async function verify(provider: string, config: Record<string, string>): Promise<VerifyResult> {
  const definition = getIntegration(provider);
  if (!definition) return { ok: false, error: "Unknown integration." };

  if (definition.implementation === "planned") {
    return {
      ok: false,
      error: `${definition.name} is not implemented yet. ${definition.capability}`,
    };
  }

  try {
    switch (provider) {
      case "stripe": {
        const response = await fetch("https://api.stripe.com/v1/account", {
          headers: { Authorization: `Bearer ${config.secretKey}` },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          return { ok: false, error: body?.error?.message ?? `Stripe rejected the key (${response.status}).` };
        }
        const account = await response.json();
        return {
          ok: true,
          label: account.settings?.dashboard?.display_name ?? account.email ?? mask(config.secretKey),
        };
      }

      case "resend": {
        const response = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (!response.ok) {
          return { ok: false, error: `Resend rejected the key (${response.status}).` };
        }
        return { ok: true, label: config.fromEmail || mask(config.apiKey) };
      }

      case "anthropic": {
        const response = await fetch("https://api.anthropic.com/v1/models?limit=1", {
          headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          return {
            ok: false,
            error: body?.error?.message ?? `Anthropic rejected the key (${response.status}).`,
          };
        }
        return { ok: true, label: mask(config.apiKey) };
      }

      case "google_analytics": {
        if (!/^G-[A-Z0-9]+$/i.test(config.measurementId ?? "")) {
          return { ok: false, error: "Measurement IDs look like G-XXXXXXX." };
        }
        return { ok: true, label: config.measurementId };
      }

      case "cjdropshipping": {
        // Authenticate the merchant's key against CJ's real token endpoint via
        // the sourcing adapter. A rejected key is never stored as connected.
        const cj = createCjProvider();
        try {
          await cj.searchProducts({ email: config.email, apiKey: config.apiKey }, { pageSize: 1 });
        } catch (error) {
          if (error instanceof SourcingError && (error.code === "auth" || error.code === "not_configured")) {
            return { ok: false, error: "CJdropshipping rejected these credentials. Check the email and API key from My CJ → API." };
          }
          // Reachability/rate-limit issues shouldn't wrongly claim the key is bad,
          // but we also must not mark connected without a real success.
          return { ok: false, error: error instanceof Error ? `Could not verify with CJdropshipping: ${error.message}` : "Could not verify with CJdropshipping." };
        }
        return { ok: true, label: config.email || mask(config.apiKey) };
      }

      case "zapier":
      case "make":
      case "slack":
      case "discord": {
        const url = config.webhookUrl ?? "";
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return { ok: false, error: "That is not a valid URL." };
        }
        if (parsed.protocol !== "https:") return { ok: false, error: "Webhook URLs must use HTTPS." };
        return { ok: true, label: `${parsed.hostname}${parsed.pathname.slice(0, 20)}…` };
      }

      default:
        return { ok: false, error: "This connector cannot be verified." };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `Could not reach the provider: ${error.message}` : "Could not reach the provider.",
    };
  }
}

export async function connectIntegration(
  ctx: ServiceContext,
  provider: string,
  config: Record<string, string>,
) {
  authorize(ctx, "integrations:write");
  const definition = getIntegration(provider);
  if (!definition) throw new ValidationError("Unknown integration.");

  for (const field of definition.fields) {
    if (!field.optional && !config[field.key]?.trim()) {
      throw new ValidationError(`${field.label} is required.`, { [field.key]: "Required" });
    }
  }

  const result = await verify(provider, config);
  if (!result.ok) {
    await prisma.integration.upsert({
      where: { storeId_provider: { storeId: ctx.storeId, provider } },
      create: { storeId: ctx.storeId, provider, status: "ERROR", lastError: result.error },
      update: { status: "ERROR", lastError: result.error },
    });
    throw new ValidationError(result.error);
  }

  await prisma.integration.upsert({
    where: { storeId_provider: { storeId: ctx.storeId, provider } },
    create: {
      storeId: ctx.storeId,
      provider,
      status: "CONNECTED",
      config: config as Prisma.InputJsonValue,
      accountLabel: result.label,
      connectedAt: new Date(),
      lastError: null,
    },
    update: {
      status: "CONNECTED",
      config: config as Prisma.InputJsonValue,
      accountLabel: result.label,
      connectedAt: new Date(),
      lastError: null,
    },
  });

  await audit(ctx, "integration.connect", { type: "Integration", id: provider }, { provider });
  return { label: result.label };
}

export async function disconnectIntegration(ctx: ServiceContext, provider: string) {
  authorize(ctx, "integrations:write");
  await prisma.integration.updateMany({
    where: { storeId: ctx.storeId, provider },
    data: { status: "DISCONNECTED", config: {}, accountLabel: null, connectedAt: null, lastError: null },
  });

  // Falling back to simulated checkout keeps the store working rather than
  // silently pointing at a payment provider that is no longer configured.
  if (provider === "stripe") {
    await prisma.storeSettings.updateMany({
      where: { storeId: ctx.storeId, checkoutMode: "stripe" },
      data: { checkoutMode: "simulated" },
    });
  }

  await audit(ctx, "integration.disconnect", { type: "Integration", id: provider }, { provider });
  return true;
}

/** Server-only credential lookup for a connected provider. */
export async function getIntegrationConfig(
  storeId: string,
  provider: string,
): Promise<Record<string, string> | null> {
  const row = await prisma.integration.findUnique({
    where: { storeId_provider: { storeId, provider } },
  });
  if (!row || row.status !== "CONNECTED") return null;
  return (row.config ?? {}) as Record<string, string>;
}

/** Fire-and-forget outbound notification for connected webhook connectors. */
export async function dispatchWebhooks(
  storeId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const rows = await prisma.integration.findMany({
    where: { storeId, status: "CONNECTED", provider: { in: ["zapier", "make", "slack", "discord"] } },
  });

  await Promise.all(
    rows.map(async (row) => {
      const config = (row.config ?? {}) as { webhookUrl?: string };
      if (!config.webhookUrl) return;

      const body =
        row.provider === "slack" || row.provider === "discord"
          ? { text: `${event}: ${JSON.stringify(payload)}`, content: `${event}: ${JSON.stringify(payload)}` }
          : { event, payload };

      await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(async (error) => {
        await prisma.integration.update({
          where: { id: row.id },
          data: { lastError: error instanceof Error ? error.message : "Delivery failed" },
        });
      });
    }),
  );
}
