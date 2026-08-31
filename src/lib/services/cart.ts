import "server-only";
import { cookies } from "next/headers";
import { prisma, type Prisma } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { round2, toNumber } from "@/lib/money";
import {
  evaluateAutomaticDiscounts, evaluateDiscountCode, type CartLine, type DiscountApplication,
} from "@/lib/services/discounts";

const CART_COOKIE = "halyard_cart";
const FREE_SHIPPING_FALLBACK = 75;
const FLAT_SHIPPING = 6.95;

export type CartItemView = {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  title: string;
  variantTitle: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  inStock: boolean;
};

export type CartView = {
  id: string | null;
  token: string | null;
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
  discount: DiscountApplication | null;
  discountError: string | null;
  automaticDiscounts: DiscountApplication[];
  discountTotal: number;
  shipping: number;
  freeShippingThreshold: number | null;
  tax: number;
  taxEnabled: boolean;
  total: number;
  currency: string;
};

export const EMPTY_CART = (currency = "USD"): CartView => ({
  id: null, token: null, items: [], itemCount: 0, subtotal: 0,
  discount: null, discountError: null, automaticDiscounts: [], discountTotal: 0,
  shipping: 0, freeShippingThreshold: null, tax: 0, taxEnabled: false, total: 0, currency,
});

async function readCartToken() {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

/** Reads the cart for the current visitor, creating one only when asked to. */
export async function getCart(storeId: string, options: { create?: boolean } = {}) {
  const token = await readCartToken();

  if (token) {
    const existing = await prisma.cart.findFirst({ where: { token, storeId } });
    if (existing) return existing;
  }
  if (!options.create) return null;

  const newToken = generateToken(18);
  const cart = await prisma.cart.create({ data: { storeId, token: newToken } });
  const jar = await cookies();
  jar.set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return cart;
}

export async function clearCartCookie() {
  const jar = await cookies();
  jar.delete(CART_COOKIE);
}

/**
 * Builds the priced cart view. Prices are always read from the catalog at
 * render time, so a price change in the admin is reflected immediately rather
 * than being frozen at add-to-cart.
 */
export async function getCartView(storeId: string): Promise<CartView> {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { currency: true, settings: true },
  });
  const settings = store.settings;
  const freeShippingThreshold = settings?.freeShippingThreshold
    ? toNumber(settings.freeShippingThreshold)
    : FREE_SHIPPING_FALLBACK;

  const cart = await getCart(storeId);
  if (!cart) return { ...EMPTY_CART(store.currency), freeShippingThreshold };

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      product: {
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          collections: { select: { collectionId: true } },
        },
      },
      variant: true,
    },
    orderBy: { id: "asc" },
  });

  // Drop lines whose product has been deleted or unpublished since adding.
  const usable = items.filter((item) => item.product && item.product.status === "ACTIVE");
  const stale = items.filter((item) => !usable.includes(item));
  if (stale.length) {
    await prisma.cartItem.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
  }

  const views: CartItemView[] = usable.map((item) => {
    const unitPrice = toNumber(item.variant?.price ?? item.product.price);
    const available = item.variant ? item.variant.inventory : item.product.inventory;
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      slug: item.product.slug,
      title: item.product.title,
      variantTitle: item.variant?.title ?? null,
      imageUrl: item.variant?.imageUrl ?? item.product.images[0]?.url ?? null,
      unitPrice,
      quantity: item.quantity,
      lineTotal: round2(unitPrice * item.quantity),
      available: item.product.trackInventory ? available : Number.MAX_SAFE_INTEGER,
      inStock: !item.product.trackInventory || available >= item.quantity,
    };
  });

  const lines: CartLine[] = usable.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: toNumber(item.variant?.price ?? item.product.price),
    collectionIds: item.product.collections.map((link) => link.collectionId),
  }));

  const subtotal = round2(views.reduce((sum, item) => sum + item.lineTotal, 0));

  let discount: DiscountApplication | null = null;
  let discountError: string | null = null;
  if (cart.discountCode && lines.length) {
    const result = await evaluateDiscountCode(storeId, cart.discountCode, lines);
    if ("application" in result) discount = result.application;
    else discountError = result.reason;
  }

  const automaticDiscounts = lines.length ? await evaluateAutomaticDiscounts(storeId, lines) : [];

  const allApplications = [...(discount ? [discount] : []), ...automaticDiscounts];
  const discountTotal = round2(
    Math.min(allApplications.reduce((sum, application) => sum + application.amount, 0), subtotal),
  );
  const freeShipping = allApplications.some((application) => application.freeShipping);

  const afterDiscount = round2(subtotal - discountTotal);
  const shipping =
    views.length === 0 || freeShipping || afterDiscount >= freeShippingThreshold ? 0 : FLAT_SHIPPING;

  const taxEnabled = settings?.taxEnabled ?? false;
  const tax = taxEnabled ? round2(afterDiscount * toNumber(settings?.taxRate)) : 0;

  return {
    id: cart.id,
    token: cart.token,
    items: views,
    itemCount: views.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discount,
    discountError,
    automaticDiscounts,
    discountTotal,
    shipping,
    freeShippingThreshold,
    tax,
    taxEnabled,
    total: round2(afterDiscount + shipping + tax),
    currency: store.currency,
  };
}

export async function addToCart(
  storeId: string,
  productId: string,
  variantId: string | null,
  quantity: number,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, status: "ACTIVE" },
    include: { variants: true },
  });
  if (!product) throw new Error("That product is no longer available.");

  const variant = variantId ? product.variants.find((v) => v.id === variantId) : null;
  if (variantId && !variant) throw new Error("That option is no longer available.");
  if (product.variants.length > 0 && !variant) throw new Error("Choose an option before adding to cart.");

  const cart = await getCart(storeId, { create: true });
  if (!cart) throw new Error("Could not open a cart.");

  const wanted = Math.max(1, Math.min(quantity, 99));
  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId: variantId ?? null },
  });
  const nextQuantity = (existing?.quantity ?? 0) + wanted;

  if (product.trackInventory) {
    const available = variant ? variant.inventory : product.inventory;
    if (available <= 0) throw new Error("That item is out of stock.");
    if (nextQuantity > available) {
      throw new Error(`Only ${available} left in stock.`);
    }
  }

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, variantId: variantId ?? null, quantity: wanted },
    });
  }
  return cart;
}

export async function updateCartItem(storeId: string, itemId: string, quantity: number) {
  const cart = await getCart(storeId);
  if (!cart) throw new Error("Your cart has expired.");

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return;
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { product: true, variant: true },
  });
  if (!item) throw new Error("That item is no longer in your cart.");

  if (item.product.trackInventory) {
    const available = item.variant ? item.variant.inventory : item.product.inventory;
    if (quantity > available) throw new Error(`Only ${available} left in stock.`);
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: Math.min(quantity, 99) } });
}

export async function removeCartItem(storeId: string, itemId: string) {
  const cart = await getCart(storeId);
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
}

export async function applyCartDiscount(storeId: string, code: string | null) {
  const cart = await getCart(storeId, { create: true });
  if (!cart) throw new Error("Could not open a cart.");

  if (!code) {
    await prisma.cart.update({ where: { id: cart.id }, data: { discountCode: null } });
    return { ok: true as const };
  }

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: { product: { include: { collections: true } }, variant: true },
  });
  const lines: CartLine[] = items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: toNumber(item.variant?.price ?? item.product.price),
    collectionIds: item.product.collections.map((link) => link.collectionId),
  }));

  const result = await evaluateDiscountCode(storeId, code, lines);
  if ("reason" in result) return { ok: false as const, reason: result.reason };

  await prisma.cart.update({
    where: { id: cart.id },
    data: { discountCode: code.trim().toUpperCase() },
  });
  return { ok: true as const, application: result.application };
}

export async function emptyCart(cartId: string, tx: Prisma.TransactionClient = prisma) {
  await tx.cartItem.deleteMany({ where: { cartId } });
  await tx.cart.update({ where: { id: cartId }, data: { discountCode: null } });
}
