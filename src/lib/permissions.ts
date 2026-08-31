import type { Role } from "@/generated/prisma/client";

/**
 * Capability model. Roles map to a set of capabilities; every server action and
 * AI tool declares the capability it needs.
 */
export const CAPABILITIES = [
  "analytics:read",
  "catalog:read",
  "catalog:write",
  "orders:read",
  "orders:write",
  "customers:read",
  "customers:write",
  "marketing:read",
  "marketing:write",
  "content:read",
  "content:write",
  "storefront:read",
  "storefront:write",
  "experiments:read",
  "experiments:write",
  "integrations:read",
  "integrations:write",
  "settings:read",
  "settings:write",
  "team:manage",
  "billing:manage",
  "ai:use",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const READ_ONLY: Capability[] = [
  "analytics:read",
  "catalog:read",
  "orders:read",
  "customers:read",
  "marketing:read",
  "content:read",
  "storefront:read",
  "experiments:read",
  "integrations:read",
  "settings:read",
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  OWNER: [...CAPABILITIES],
  ADMIN: CAPABILITIES.filter((c) => c !== "billing:manage"),
  MARKETING: [
    ...READ_ONLY,
    "marketing:write",
    "content:write",
    "storefront:write",
    "experiments:write",
    "catalog:write",
    "ai:use",
  ],
  SUPPORT: [
    ...READ_ONLY.filter((c) => c !== "settings:read"),
    "orders:write",
    "customers:write",
    "ai:use",
  ],
  ANALYST: [...READ_ONLY, "ai:use"],
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MARKETING: "Marketing",
  SUPPORT: "Support",
  ANALYST: "Analyst",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access including billing and team management.",
  ADMIN: "Full access to the store; cannot manage billing.",
  MARKETING: "Campaigns, content, storefront, discounts and experiments.",
  SUPPORT: "Orders and customers; read-only elsewhere.",
  ANALYST: "Read-only access to analytics and business data.",
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export class AuthorizationError extends Error {
  readonly capability: Capability;
  constructor(capability: Capability) {
    super(`Your role does not allow "${capability}".`);
    this.name = "AuthorizationError";
    this.capability = capability;
  }
}

export function assertCan(role: Role, capability: Capability): void {
  if (!can(role, capability)) throw new AuthorizationError(capability);
}
