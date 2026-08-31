import "server-only";
import { Prisma, prisma, type Discount } from "@/lib/db";
import { round2, toNumber } from "@/lib/money";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { discountInputSchema } from "@/lib/validation/commerce";

export type AppliesTo = {
  scope: "all" | "products" | "collections";
  productIds?: string[];
  collectionIds?: string[];
};

export type BxgyConfig = { buyQuantity: number; getQuantity: number; getDiscountPercent: number };

export function parseAppliesTo(value: unknown): AppliesTo {
  const raw = (value ?? {}) as Partial<AppliesTo>;
  return {
    scope: raw.scope === "products" || raw.scope === "collections" ? raw.scope : "all",
    productIds: Array.isArray(raw.productIds) ? raw.productIds : [],
    collectionIds: Array.isArray(raw.collectionIds) ? raw.collectionIds : [],
  };
}

/** Status derived from the schedule, so a discount is never stale in the UI. */
export function effectiveStatus(discount: Pick<Discount, "status" | "startsAt" | "endsAt" | "usageLimit" | "usageCount">) {
  if (discount.status === "DRAFT" || discount.status === "DISABLED") return discount.status;
  const now = new Date();
  if (discount.endsAt && discount.endsAt < now) return "EXPIRED" as const;
  if (discount.startsAt > now) return "SCHEDULED" as const;
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) return "EXPIRED" as const;
  return "ACTIVE" as const;
}

export async function listDiscounts(ctx: ServiceContext) {
  authorize(ctx, "marketing:read");
  const discounts = await prisma.discount.findMany({
    where: { storeId: ctx.storeId },
    orderBy: { createdAt: "desc" },
  });
  return discounts.map((discount) => ({ ...discount, effectiveStatus: effectiveStatus(discount) }));
}

export async function getDiscount(ctx: ServiceContext, id: string) {
  authorize(ctx, "marketing:read");
  const discount = await prisma.discount.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!discount) throw new NotFoundError("Discount");
  return discount;
}

function toRecord(input: ReturnType<typeof discountInputSchema.parse>) {
  const appliesTo: AppliesTo = {
    scope: input.appliesToScope,
    productIds: input.appliesToScope === "products" ? input.productIds : [],
    collectionIds: input.appliesToScope === "collections" ? input.collectionIds : [],
  };
  const bxgy: BxgyConfig | null =
    input.type === "BUY_X_GET_Y"
      ? {
          buyQuantity: input.buyQuantity,
          getQuantity: input.getQuantity,
          getDiscountPercent: input.getDiscountPercent,
        }
      : null;

  return {
    title: input.title,
    code: input.automatic ? null : input.code?.toUpperCase() || null,
    automatic: input.automatic,
    type: input.type,
    status: input.status,
    value: input.value,
    minPurchase: input.minPurchase ?? null,
    minQuantity: input.minQuantity ?? null,
    usageLimit: input.usageLimit ?? null,
    oncePerCustomer: input.oncePerCustomer,
    appliesTo: appliesTo as unknown as Prisma.InputJsonValue,
    bxgyConfig: bxgy === null ? Prisma.JsonNull : (bxgy as unknown as Prisma.InputJsonValue),
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
  };
}

export async function createDiscount(ctx: ServiceContext, raw: unknown) {
  authorize(ctx, "marketing:write");
  const input = discountInputSchema.parse(raw);
  const record = toRecord(input);

  if (record.code) {
    const clash = await prisma.discount.findFirst({
      where: { storeId: ctx.storeId, code: record.code },
      select: { id: true },
    });
    if (clash) throw new ValidationError(`The code ${record.code} is already in use.`, { code: "That code already exists." });
  }

  const discount = await prisma.discount.create({ data: { storeId: ctx.storeId, ...record } });
  await audit(ctx, "discount.create", { type: "Discount", id: discount.id }, { code: discount.code, type: discount.type, value: toNumber(discount.value) });
  return discount;
}

export async function updateDiscount(ctx: ServiceContext, id: string, raw: unknown) {
  authorize(ctx, "marketing:write");
  const existing = await prisma.discount.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Discount");

  const merged = discountInputSchema.parse({
    title: existing.title,
    code: existing.code,
    automatic: existing.automatic,
    type: existing.type,
    status: existing.status,
    value: toNumber(existing.value),
    minPurchase: existing.minPurchase ? toNumber(existing.minPurchase) : null,
    minQuantity: existing.minQuantity,
    usageLimit: existing.usageLimit,
    oncePerCustomer: existing.oncePerCustomer,
    appliesToScope: parseAppliesTo(existing.appliesTo).scope,
    productIds: parseAppliesTo(existing.appliesTo).productIds ?? [],
    collectionIds: parseAppliesTo(existing.appliesTo).collectionIds ?? [],
    ...(existing.bxgyConfig as BxgyConfig | null),
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    ...(raw as Record<string, unknown>),
  });

  const record = toRecord(merged);
  if (record.code && record.code !== existing.code) {
    const clash = await prisma.discount.findFirst({
      where: { storeId: ctx.storeId, code: record.code, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new ValidationError(`The code ${record.code} is already in use.`, { code: "That code already exists." });
  }

  const discount = await prisma.discount.update({ where: { id }, data: record });
  await audit(ctx, "discount.update", { type: "Discount", id });
  return discount;
}

export async function deleteDiscount(ctx: ServiceContext, id: string) {
  authorize(ctx, "marketing:write");
  const result = await prisma.discount.deleteMany({ where: { id, storeId: ctx.storeId } });
  if (!result.count) throw new NotFoundError("Discount");
  await audit(ctx, "discount.delete", { type: "Discount", id });
  return true;
}

// ---------------------------------------------------------------------------
// Checkout evaluation
// ---------------------------------------------------------------------------

export type CartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  collectionIds: string[];
};

export type DiscountApplication = {
  discountId: string;
  code: string | null;
  title: string;
  type: Discount["type"];
  amount: number;
  freeShipping: boolean;
};

function lineIsEligible(line: CartLine, appliesTo: AppliesTo) {
  if (appliesTo.scope === "all") return true;
  if (appliesTo.scope === "products") return (appliesTo.productIds ?? []).includes(line.productId);
  return line.collectionIds.some((id) => (appliesTo.collectionIds ?? []).includes(id));
}

/**
 * Calculates what a discount is worth for a given cart. Returns null when the
 * discount does not apply, with the reason available to the caller.
 */
export function applyDiscount(
  discount: Discount,
  lines: CartLine[],
): { application: DiscountApplication } | { reason: string } {
  const status = effectiveStatus(discount);
  if (status !== "ACTIVE") {
    return { reason: status === "SCHEDULED" ? "This discount has not started yet." : "This discount is no longer available." };
  }

  const appliesTo = parseAppliesTo(discount.appliesTo);
  const eligible = lines.filter((line) => lineIsEligible(line, appliesTo));
  if (!eligible.length) return { reason: "No items in your cart qualify for this discount." };

  const eligibleSubtotal = round2(eligible.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const cartSubtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);

  if (discount.minPurchase && cartSubtotal < toNumber(discount.minPurchase)) {
    return { reason: `Spend at least $${toNumber(discount.minPurchase).toFixed(2)} to use this discount.` };
  }
  if (discount.minQuantity && totalQuantity < discount.minQuantity) {
    return { reason: `Add at least ${discount.minQuantity} items to use this discount.` };
  }

  const base: Omit<DiscountApplication, "amount" | "freeShipping"> = {
    discountId: discount.id,
    code: discount.code,
    title: discount.title,
    type: discount.type,
  };

  switch (discount.type) {
    case "FREE_SHIPPING":
      return { application: { ...base, amount: 0, freeShipping: true } };

    case "PERCENTAGE":
      return {
        application: {
          ...base,
          amount: round2(eligibleSubtotal * (toNumber(discount.value) / 100)),
          freeShipping: false,
        },
      };

    case "FIXED_AMOUNT":
      return {
        application: {
          ...base,
          amount: round2(Math.min(toNumber(discount.value), eligibleSubtotal)),
          freeShipping: false,
        },
      };

    case "BUY_X_GET_Y": {
      const config = (discount.bxgyConfig ?? {}) as Partial<BxgyConfig>;
      const buy = config.buyQuantity ?? 2;
      const get = config.getQuantity ?? 1;
      const percent = config.getDiscountPercent ?? 100;

      // Expand eligible lines into units, cheapest units are the ones discounted.
      const units = eligible
        .flatMap((line) => Array.from({ length: line.quantity }, () => line.unitPrice))
        .sort((a, b) => a - b);

      const sets = Math.floor(units.length / (buy + get));
      if (sets < 1) return { reason: `Add ${buy + get} qualifying items to use this discount.` };

      const discounted = units.slice(0, sets * get);
      const amount = round2(discounted.reduce((sum, price) => sum + price * (percent / 100), 0));
      return { application: { ...base, amount, freeShipping: false } };
    }

    default:
      return { reason: "This discount type is not supported." };
  }
}

/** Looks up a code and evaluates it against a cart. */
export async function evaluateDiscountCode(
  storeId: string,
  code: string,
  lines: CartLine[],
): Promise<{ application: DiscountApplication } | { reason: string }> {
  const discount = await prisma.discount.findFirst({
    where: { storeId, code: code.trim().toUpperCase() },
  });
  if (!discount) return { reason: "That discount code was not found." };
  return applyDiscount(discount, lines);
}

/** Automatic discounts that currently apply, best-value first. */
export async function evaluateAutomaticDiscounts(storeId: string, lines: CartLine[]) {
  const discounts = await prisma.discount.findMany({ where: { storeId, automatic: true } });
  const applications: DiscountApplication[] = [];
  for (const discount of discounts) {
    const result = applyDiscount(discount, lines);
    if ("application" in result) applications.push(result.application);
  }
  return applications.sort((a, b) => b.amount - a.amount);
}
