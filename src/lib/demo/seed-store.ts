/**
 * Generates the seeded demo business.
 *
 * Everything written here is flagged `isDemo: true` so the UI can label it and
 * an operator can purge it once real data starts flowing. Values come from a
 * fixed-seed PRNG, so the same store is produced on every run — dashboards are
 * populated but never randomised between page loads.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { mulberry32, slugify } from "@/lib/utils";
import { round2 } from "@/lib/money";
import { bannerPlaceholderSvg, productPlaceholderSvg } from "@/lib/demo/images";
import {
  DEMO_CATEGORIES,
  DEMO_CITIES,
  DEMO_COLLECTIONS,
  DEMO_FIRST_NAMES,
  DEMO_LAST_NAMES,
  DEMO_PRODUCTS,
  DEVICE_WEIGHTS,
  REVIEW_SNIPPETS,
  SOURCE_WEIGHTS,
  TRAFFIC_SOURCES,
  type TrafficSource,
} from "@/lib/demo/catalog";
import { DEMO_CONTENT_PAGES, defaultHomepageSections } from "@/lib/demo/storefront-pages";

const SEED = 20260401;
const DAYS = 180;

type Rng = () => number;

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function weightedPick<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[0][0];
}

function intBetween(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgo(n: number) {
  const d = startOfDay(new Date());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Seasonality + a gentle growth trend + weekday effect. Produces a curve that
 * looks like a real store rather than noise.
 */
function trafficForDay(dayIndex: number, rng: Rng) {
  const t = (DAYS - dayIndex) / DAYS; // 0 = oldest, 1 = newest
  const trend = 0.72 + t * 0.55;
  const date = daysAgo(dayIndex);
  const dow = date.getUTCDay();
  const weekday = dow === 0 || dow === 6 ? 0.82 : dow === 1 ? 1.12 : 1;
  const wave = 1 + Math.sin(dayIndex / 11) * 0.14 + Math.sin(dayIndex / 3.5) * 0.05;
  const noise = 0.9 + rng() * 0.22;
  // A promotional spike ~3 weeks back
  const spike = dayIndex >= 20 && dayIndex <= 23 ? 1.55 : 1;
  return Math.max(60, Math.round(420 * trend * weekday * wave * noise * spike));
}

async function writeImage(publicDir: string, relPath: string, svg: string) {
  const full = path.join(publicDir, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, svg, "utf8");
  return `/${relPath.split(path.sep).join("/")}`;
}

export type SeedOptions = {
  /** Absolute path to the Next `public/` directory for placeholder artwork. */
  publicDir: string;
  /** Emit progress lines. */
  log?: (message: string) => void;
};

export async function seedDemoStore(
  prisma: PrismaClient,
  storeId: string,
  options: SeedOptions,
) {
  const log = options.log ?? (() => {});
  const rng = mulberry32(SEED);
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });

  // -- categories ----------------------------------------------------------
  log("categories");
  const categoryIds = new Map<string, string>();
  for (const cat of DEMO_CATEGORIES.filter((c) => !c.parent)) {
    const created = await prisma.category.create({
      data: { storeId, name: cat.name, slug: cat.slug, description: cat.description },
    });
    categoryIds.set(cat.slug, created.id);
  }
  for (const cat of DEMO_CATEGORIES.filter((c) => c.parent)) {
    const created = await prisma.category.create({
      data: {
        storeId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parentId: categoryIds.get(cat.parent!) ?? null,
      },
    });
    categoryIds.set(cat.slug, created.id);
  }

  // -- products ------------------------------------------------------------
  log("products");
  type SeededProduct = {
    id: string;
    title: string;
    price: number;
    weight: number;
    variants: Array<{ id: string; title: string; price: number }>;
    imageUrl: string;
    status: string;
  };
  const products: SeededProduct[] = [];

  for (const [index, def] of DEMO_PRODUCTS.entries()) {
    const slug = slugify(def.title);
    const imageUrl = await writeImage(
      options.publicDir,
      path.join("demo", "products", `${slug}.svg`),
      productPlaceholderSvg(def.title, "", def.category),
    );
    const altUrl = await writeImage(
      options.publicDir,
      path.join("demo", "products", `${slug}-2.svg`),
      productPlaceholderSvg(def.title, "alt", def.category),
    );

    // Build the variant matrix from the option axes.
    const axes = def.axes ?? [];
    let combos: Array<Record<string, string>> = [{}];
    for (const axis of axes) {
      combos = combos.flatMap((combo) =>
        axis.values.map((value) => ({ ...combo, [axis.name]: value })),
      );
    }
    const hasVariants = axes.length > 0;

    const product = await prisma.product.create({
      data: {
        storeId,
        title: def.title,
        slug,
        description: def.description,
        status: (def.status ?? "ACTIVE") as never,
        price: def.price,
        compareAtPrice: def.compareAtPrice ?? null,
        cost: def.cost,
        sku: `NW-${String(index + 1).padStart(3, "0")}`,
        trackInventory: true,
        inventory: hasVariants ? 0 : def.inventory,
        categoryId: categoryIds.get(def.category) ?? null,
        vendor: def.vendor,
        tags: def.tags,
        isDemo: true,
        seoTitle: `${def.title} · Northwind Supply Co.`,
        seoDescription: def.description.slice(0, 155),
        createdAt: daysAgo(DAYS - index * 4),
        images: {
          create: [
            { url: imageUrl, alt: `${def.title} — front`, position: 0 },
            { url: altUrl, alt: `${def.title} — detail`, position: 1 },
          ],
        },
      },
    });

    const variants: SeededProduct["variants"] = [];
    if (hasVariants) {
      let total = 0;
      for (const [vIndex, combo] of combos.entries()) {
        const title = Object.values(combo).join(" / ");
        const inventory = intBetween(rng, 0, 42);
        total += inventory;
        const created = await prisma.productVariant.create({
          data: {
            productId: product.id,
            title,
            options: combo as Prisma.InputJsonValue,
            sku: `NW-${String(index + 1).padStart(3, "0")}-${vIndex + 1}`,
            inventory,
            position: vIndex,
          },
        });
        variants.push({ id: created.id, title, price: def.price });
      }
      await prisma.product.update({ where: { id: product.id }, data: { inventory: total } });
    }

    products.push({
      id: product.id,
      title: def.title,
      price: def.price,
      weight: def.weight,
      variants,
      imageUrl,
      status: def.status ?? "ACTIVE",
    });
  }

  const sellable = products.filter((p) => p.status === "ACTIVE");

  // -- collections ---------------------------------------------------------
  log("collections");
  const collectionIds = new Map<string, string>();
  for (const [index, def] of DEMO_COLLECTIONS.entries()) {
    const imageUrl = await writeImage(
      options.publicDir,
      path.join("demo", "collections", `${def.slug}.svg`),
      bannerPlaceholderSvg(def.title, store.primaryColor),
    );
    const collection = await prisma.collection.create({
      data: {
        storeId,
        title: def.title,
        slug: def.slug,
        description: def.description,
        imageUrl,
        type: def.type as never,
        rules: (def.rules ?? { match: "all", rules: [] }) as Prisma.InputJsonValue,
        position: index,
      },
    });
    collectionIds.set(def.slug, collection.id);

    if (def.type === "MANUAL" && def.productTitles) {
      for (const [pIndex, title] of def.productTitles.entries()) {
        const product = products.find((p) => p.title === title);
        if (!product) continue;
        await prisma.collectionProduct.create({
          data: { collectionId: collection.id, productId: product.id, position: pIndex },
        });
      }
    }
  }

  // -- customers -----------------------------------------------------------
  // Customers are created as orders arrive rather than up front, so the ratio
  // of new to repeat buyers — and therefore lifetime value — stays plausible.
  log("customers");
  type SeededCustomer = { id: string; email: string; name: string; createdAt: Date };
  const customers: SeededCustomer[] = [];
  let customerCounter = 0;

  async function createCustomer(createdAt: Date): Promise<SeededCustomer> {
    const first = pick(rng, DEMO_FIRST_NAMES);
    const last = pick(rng, DEMO_LAST_NAMES);
    customerCounter += 1;
    const email = `${first}.${last}${customerCounter}`
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "") + "@example.test";
    const [city, region, postal] = pick(rng, DEMO_CITIES);
    const tags: string[] = [];
    if (rng() < 0.08) tags.push("vip");
    if (rng() < 0.05) tags.push("wholesale-interest");

    const customer = await prisma.customer.create({
      data: {
        storeId,
        email,
        firstName: first,
        lastName: last,
        phone: `+1 555 ${intBetween(rng, 100, 999)} ${intBetween(rng, 1000, 9999)}`,
        tags,
        isDemo: true,
        acceptsMarketing: rng() < 0.62,
        createdAt,
        addresses: {
          create: [
            {
              label: "shipping",
              line1: `${intBetween(rng, 10, 4800)} ${pick(rng, ["Alder", "Kearney", "Marshall", "Hawthorne", "Belmont", "Division"])} St`,
              line2: rng() < 0.3 ? `Apt ${intBetween(rng, 1, 40)}` : null,
              city,
              region,
              postalCode: postal,
              country: "US",
              isDefault: true,
            },
          ],
        },
      },
    });

    const seeded = { id: customer.id, email, name: `${first} ${last}`, createdAt };
    customers.push(seeded);
    return seeded;
  }

  // -- discounts -----------------------------------------------------------
  log("discounts");
  const fleeceId = collectionIds.get("fleece")!;
  const carryId = collectionIds.get("carry")!;
  const discounts = await Promise.all([
    prisma.discount.create({
      data: {
        storeId, code: "WELCOME10", title: "Welcome 10% off", type: "PERCENTAGE",
        status: "ACTIVE", value: 10, minPurchase: 40, usageLimit: null, usageCount: 214,
        appliesTo: { scope: "all" }, isDemo: true, startsAt: daysAgo(DAYS),
      },
    }),
    prisma.discount.create({
      data: {
        storeId, code: "FLEECE20", title: "Fleece Shop 20% off", type: "PERCENTAGE",
        status: "ACTIVE", value: 20, usageCount: 87,
        appliesTo: { scope: "collections", collectionIds: [fleeceId] },
        isDemo: true, startsAt: daysAgo(30), endsAt: daysAgo(-14),
      },
    }),
    prisma.discount.create({
      data: {
        storeId, code: "FREESHIP", title: "Free shipping over $50", type: "FREE_SHIPPING",
        status: "ACTIVE", value: 0, minPurchase: 50, usageCount: 341,
        appliesTo: { scope: "all" }, isDemo: true, startsAt: daysAgo(DAYS),
      },
    }),
    prisma.discount.create({
      data: {
        storeId, code: "SPRING15", title: "Spring sale 15% off", type: "PERCENTAGE",
        status: "EXPIRED", value: 15, usageCount: 129,
        appliesTo: { scope: "all" }, isDemo: true,
        startsAt: daysAgo(120), endsAt: daysAgo(96),
      },
    }),
    prisma.discount.create({
      data: {
        storeId, code: "CARRY25", title: "$25 off bags", type: "FIXED_AMOUNT",
        status: "DRAFT", value: 25, minPurchase: 120, usageCount: 0,
        appliesTo: { scope: "collections", collectionIds: [carryId] },
        isDemo: true, startsAt: daysAgo(-1),
      },
    }),
  ]);
  const activeCodes = discounts.filter((d) => d.status === "ACTIVE").map((d) => d.code!);

  // -- orders + analytics --------------------------------------------------
  log("orders and analytics");
  const totalWeight = sellable.reduce((s, p) => s + p.weight, 0);
  function pickProduct(): SeededProduct {
    let roll = rng() * totalWeight;
    for (const product of sellable) {
      roll -= product.weight;
      if (roll <= 0) return product;
    }
    return sellable[0];
  }

  let orderNumber = 1000;
  const dailyRows: Prisma.AnalyticsDailyCreateManyInput[] = [];
  const eventRows: Prisma.AnalyticsEventCreateManyInput[] = [];
  const createdOrders: Array<{ id: string; createdAt: Date; total: number; source: string }> = [];

  for (let dayIndex = DAYS; dayIndex >= 0; dayIndex--) {
    const date = daysAgo(dayIndex);
    const sessions = trafficForDay(dayIndex, rng);
    const visitors = Math.round(sessions * (0.86 + rng() * 0.07));
    const pageViews = Math.round(sessions * (2.3 + rng() * 0.9));
    const productViews = Math.round(sessions * (0.58 + rng() * 0.18));
    const addToCarts = Math.round(productViews * (0.19 + rng() * 0.06));
    const checkoutsStarted = Math.round(addToCarts * (0.47 + rng() * 0.1));
    const orderCount = Math.max(0, Math.round(checkoutsStarted * (0.56 + rng() * 0.12)));

    const sourceBreakdown: Record<string, number> = {};
    for (const source of TRAFFIC_SOURCES) {
      sourceBreakdown[source] = Math.round(sessions * SOURCE_WEIGHTS[source] * (0.85 + rng() * 0.3));
    }
    const deviceBreakdown: Record<string, number> = {};
    for (const device of Object.keys(DEVICE_WEIGHTS)) {
      deviceBreakdown[device] = Math.round(sessions * DEVICE_WEIGHTS[device] * (0.9 + rng() * 0.2));
    }

    let grossSales = 0;
    let discountTotalDay = 0;
    let refundsDay = 0;
    let unitsDay = 0;

    for (let o = 0; o < orderCount; o++) {
      const hour = intBetween(rng, 7, 22);
      const createdAt = new Date(date);
      createdAt.setUTCHours(hour, intBetween(rng, 0, 59), intBetween(rng, 0, 59));

      const lineCount = rng() < 0.55 ? 1 : rng() < 0.85 ? 2 : 3;
      const chosen = new Map<string, { product: SeededProduct; quantity: number }>();
      for (let l = 0; l < lineCount; l++) {
        const product = pickProduct();
        const existing = chosen.get(product.id);
        if (existing) existing.quantity += 1;
        else chosen.set(product.id, { product, quantity: rng() < 0.82 ? 1 : 2 });
      }

      const items = Array.from(chosen.values()).map(({ product, quantity }) => {
        const variant = product.variants.length ? pick(rng, product.variants) : null;
        const unitPrice = variant?.price ?? product.price;
        return {
          productId: product.id,
          variantId: variant?.id ?? null,
          title: product.title,
          variantTitle: variant?.title ?? null,
          quantity,
          unitPrice,
          total: round2(unitPrice * quantity),
          imageUrl: product.imageUrl,
        };
      });

      const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
      const useDiscount = rng() < 0.28;
      const code = useDiscount ? pick(rng, activeCodes) : null;
      const discountAmount =
        code === "FREESHIP" ? 0 : useDiscount ? round2(subtotal * (code === "FLEECE20" ? 0.2 : 0.1)) : 0;
      const shipping = subtotal - discountAmount >= 75 || code === "FREESHIP" ? 0 : 6.95;
      const tax = round2((subtotal - discountAmount) * 0.0725);
      const total = round2(subtotal - discountAmount + shipping + tax);

      // Roughly a third of orders come from someone who has bought before,
      // which is a realistic repeat rate for a brand of this size.
      const returning = customers.length > 20 && rng() < 0.34;
      const customer =
        rng() < 0.9
          ? returning
            ? pick(rng, customers)
            : await createCustomer(createdAt)
          : null;
      const source = weightedPick(rng, SOURCE_WEIGHTS) as TrafficSource;

      const refunded = rng() < 0.05;
      const paymentStatus = refunded ? (rng() < 0.5 ? "REFUNDED" : "PARTIALLY_REFUNDED") : "PAID";
      const refundedTotal = refunded ? (paymentStatus === "REFUNDED" ? total : round2(total * 0.4)) : 0;

      const age = dayIndex;
      const fulfillmentStatus =
        age > 4 ? "FULFILLED" : age > 2 ? (rng() < 0.7 ? "FULFILLED" : "PARTIALLY_FULFILLED") : rng() < 0.4 ? "FULFILLED" : "UNFULFILLED";

      orderNumber += 1;
      const [city, region, postal] = pick(rng, DEMO_CITIES);
      const address = {
        name: customer?.name ?? "Guest customer",
        line1: `${intBetween(rng, 10, 4800)} ${pick(rng, ["Alder", "Kearney", "Marshall", "Hawthorne"])} St`,
        city, region, postalCode: postal, country: "US",
      };

      const order = await prisma.order.create({
        data: {
          storeId,
          number: orderNumber,
          customerId: customer?.id ?? null,
          email: customer?.email ?? `guest${orderNumber}@example.test`,
          paymentStatus: paymentStatus as never,
          fulfillmentStatus: fulfillmentStatus as never,
          subtotal, discountTotal: discountAmount, shippingTotal: shipping,
          taxTotal: tax, total, refundedTotal,
          discountCode: code,
          trackingNumber: fulfillmentStatus === "FULFILLED" ? `NW${intBetween(rng, 10000000, 99999999)}` : null,
          trackingCarrier: fulfillmentStatus === "FULFILLED" ? pick(rng, ["USPS", "UPS", "FedEx"]) : null,
          isDemo: true,
          shippingAddress: address,
          billingAddress: address,
          source,
          utmSource: source === "direct" ? null : source,
          utmMedium: source === "email" ? "newsletter" : source === "google" ? "cpc" : "social",
          createdAt,
          items: { create: items },
          payments: {
            create: [{ amount: total, status: paymentStatus as never, provider: "simulated", createdAt }],
          },
          events: {
            create: [
              { type: "created", message: `Order #${orderNumber} placed`, actor: "system", createdAt },
              { type: "paid", message: `Payment of $${total.toFixed(2)} captured (simulated)`, actor: "system", createdAt },
              ...(fulfillmentStatus === "FULFILLED"
                ? [{ type: "fulfilled", message: "All items fulfilled", actor: "system", createdAt: new Date(createdAt.getTime() + 864e5) }]
                : []),
              ...(refunded
                ? [{ type: "refunded", message: `Refund of $${refundedTotal.toFixed(2)} issued`, actor: "system", createdAt: new Date(createdAt.getTime() + 2 * 864e5) }]
                : []),
            ],
          },
        },
      });

      createdOrders.push({ id: order.id, createdAt, total, source });
      grossSales += subtotal;
      discountTotalDay += discountAmount;
      refundsDay += refundedTotal;
      unitsDay += items.reduce((s, i) => s + i.quantity, 0);
    }

    dailyRows.push({
      storeId,
      date,
      visitors,
      sessions,
      pageViews,
      productViews,
      addToCarts,
      checkoutsStarted,
      orders: orderCount,
      unitsSold: unitsDay,
      grossSales: round2(grossSales),
      discounts: round2(discountTotalDay),
      refunds: round2(refundsDay),
      netSales: round2(grossSales - discountTotalDay - refundsDay),
      sourceBreakdown,
      deviceBreakdown,
      isDemo: true,
    });

    // Raw events are expensive; keep a representative sample for the most
    // recent fortnight so the event pipeline has real rows to query.
    if (dayIndex <= 14) {
      const sampleSessions = Math.min(60, Math.round(sessions / 8));
      for (let s = 0; s < sampleSessions; s++) {
        const sessionId = `demo-${dayIndex}-${s}`;
        const source = weightedPick(rng, SOURCE_WEIGHTS) as TrafficSource;
        const device = weightedPick(rng, DEVICE_WEIGHTS);
        const at = new Date(date);
        at.setUTCHours(intBetween(rng, 6, 23), intBetween(rng, 0, 59));
        const base = { storeId, sessionId, source, device, isDemo: true, createdAt: at } as const;

        eventRows.push({ ...base, type: "page_view", path: "/" });
        if (rng() < 0.7) {
          const product = pickProduct();
          eventRows.push({ ...base, type: "product_view", productId: product.id, path: `/products/${slugify(product.title)}` });
          if (rng() < 0.28) {
            eventRows.push({ ...base, type: "add_to_cart", productId: product.id, value: product.price });
            if (rng() < 0.5) {
              eventRows.push({ ...base, type: "checkout_started", value: product.price });
              if (rng() < 0.55) eventRows.push({ ...base, type: "purchase", value: product.price });
            }
          }
        }
        if (rng() < 0.06) eventRows.push({ ...base, type: "email_signup" });
      }
    }
  }

  await prisma.analyticsDaily.createMany({ data: dailyRows });
  for (let i = 0; i < eventRows.length; i += 1000) {
    await prisma.analyticsEvent.createMany({ data: eventRows.slice(i, i + 1000) });
  }
  log(`  ${createdOrders.length} orders, ${eventRows.length} events`);

  // -- reviews -------------------------------------------------------------
  log("reviews");
  const reviewRows: Prisma.ReviewCreateManyInput[] = [];
  if (!customers.length) await createCustomer(daysAgo(DAYS));
  for (const product of sellable) {
    const count = Math.max(1, Math.round(product.weight * 1.4));
    for (let i = 0; i < count; i++) {
      const snippet = pick(rng, REVIEW_SNIPPETS);
      const customer = pick(rng, customers);
      reviewRows.push({
        storeId,
        productId: product.id,
        customerId: rng() < 0.8 ? customer.id : null,
        authorName: customer.name,
        rating: snippet.rating,
        title: snippet.title,
        body: snippet.body,
        verified: rng() < 0.78,
        status: rng() < 0.88 ? "PUBLISHED" : "PENDING",
        isDemo: true,
        createdAt: daysAgo(intBetween(rng, 1, 150)),
      });
    }
  }
  await prisma.review.createMany({ data: reviewRows });

  // -- pages ---------------------------------------------------------------
  log("pages");
  const heroImage = await writeImage(
    options.publicDir,
    path.join("demo", "banners", "hero.svg"),
    bannerPlaceholderSvg("Northwind hero", store.primaryColor),
  );
  const storyImage = await writeImage(
    options.publicDir,
    path.join("demo", "banners", "story.svg"),
    bannerPlaceholderSvg("Northwind story", store.secondaryColor),
  );

  const sections = defaultHomepageSections({ name: store.name, description: store.description });
  const homepage = await prisma.page.create({
    data: {
      storeId,
      type: "HOME",
      title: "Home",
      slug: "home",
      published: true,
      publishedAt: new Date(),
      seoTitle: "Northwind Supply Co. — everyday things, built properly",
      seoDescription:
        "A small range of well-made essentials: fleece, canvas bags, stoneware and lighting. Free shipping over $75.",
      sections: {
        create: sections.map((section, index) => {
          const config = { ...(section.config as Record<string, unknown>) };
          if (section.type === "hero") config.imageUrl = heroImage;
          if (section.type === "imageText") config.imageUrl = storyImage;
          return {
            type: section.type,
            position: index,
            visible: section.visible ?? true,
            config: config as Prisma.InputJsonValue,
          };
        }),
      },
    },
  });

  for (const page of DEMO_CONTENT_PAGES) {
    await prisma.page.create({
      data: {
        storeId,
        type: "STANDARD",
        title: page.title,
        slug: page.slug,
        body: page.body,
        published: true,
        publishedAt: new Date(),
        showInNav: page.showInNav ?? false,
        seoTitle: `${page.title} · Northwind Supply Co.`,
        seoDescription: page.seoDescription,
      },
    });
  }

  // -- navigation ----------------------------------------------------------
  const mainNav = [
    { label: "Shop", href: "/shop" },
    { label: "Collections", href: "/collections" },
    { label: "About", href: "/pages/about" },
    { label: "FAQ", href: "/pages/faq" },
  ];
  const footerNav = [
    { label: "Shipping", href: "/pages/shipping" },
    { label: "Returns", href: "/pages/returns" },
    { label: "Contact", href: "/pages/contact" },
    { label: "Privacy", href: "/pages/privacy" },
    { label: "Terms", href: "/pages/terms" },
  ];
  await prisma.navigationItem.createMany({
    data: [
      ...mainNav.map((item, i) => ({ storeId, ...item, position: i, group: "main" })),
      ...footerNav.map((item, i) => ({ storeId, ...item, position: i, group: "footer" })),
    ],
  });

  // -- experiments ---------------------------------------------------------
  log("experiments");
  const heroSection = await prisma.pageSection.findFirst({
    where: { pageId: homepage.id, type: "hero" },
  });
  const hoodie = products.find((p) => p.title === "Essential Hoodie")!;

  const experimentSpecs: Array<{
    name: string;
    hypothesis: string;
    status: "RUNNING" | "COMPLETED" | "DRAFT" | "PAUSED";
    testType: string;
    targetType: "page" | "product";
    goal: string;
    startedDaysAgo: number | null;
    endedDaysAgo: number | null;
    variants: Array<{ name: string; isControl?: boolean; weight: number; changes: Record<string, unknown>; lift: number }>;
  }> = [
    {
      name: "Homepage hero headline",
      hypothesis: "Leading with the shipping offer converts better than the brand statement.",
      status: "RUNNING",
      testType: "headline",
      targetType: "page",
      goal: "purchase",
      startedDaysAgo: 18,
      endedDaysAgo: null,
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { headline: "Everyday things, built properly." }, lift: 1 },
        { name: "B", weight: 50, changes: { headline: "Free shipping. Better essentials." }, lift: 1.14 },
      ],
    },
    {
      name: "Essential Hoodie product title",
      hypothesis: "Naming the fabric weight sets expectations and reduces bounce.",
      status: "RUNNING",
      testType: "product_title",
      targetType: "product",
      goal: "add_to_cart",
      startedDaysAgo: 9,
      endedDaysAgo: null,
      variants: [
        { name: "A", isControl: true, weight: 34, changes: { title: "Essential Hoodie" }, lift: 1 },
        { name: "B", weight: 33, changes: { title: "Essential Hoodie — 420gsm Loopback Fleece" }, lift: 1.07 },
        { name: "C", weight: 33, changes: { title: "The Hoodie You'll Wear Every Day" }, lift: 0.94 },
      ],
    },
    {
      name: "Announcement bar offer",
      hypothesis: "A dollar threshold outperforms a percentage framing.",
      status: "COMPLETED",
      testType: "cta",
      targetType: "page",
      goal: "purchase",
      startedDaysAgo: 62,
      endedDaysAgo: 24,
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { text: "10% off your first order" }, lift: 1 },
        { name: "B", weight: 50, changes: { text: "Free shipping on orders over $75" }, lift: 1.48 },
      ],
    },
    {
      name: "Product page CTA wording",
      hypothesis: "\"Add to bag\" reads more natural than \"Add to cart\" for this audience.",
      status: "DRAFT",
      testType: "cta",
      targetType: "product",
      goal: "add_to_cart",
      startedDaysAgo: null,
      endedDaysAgo: null,
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { ctaLabel: "Add to cart" }, lift: 1 },
        { name: "B", weight: 50, changes: { ctaLabel: "Add to bag" }, lift: 1 },
      ],
    },
  ];

  for (const spec of experimentSpecs) {
    const experiment = await prisma.experiment.create({
      data: {
        storeId,
        name: spec.name,
        hypothesis: spec.hypothesis,
        status: spec.status as never,
        testType: spec.testType,
        targetType: spec.targetType,
        pageId: spec.targetType === "page" ? homepage.id : null,
        sectionId: spec.testType === "headline" ? heroSection?.id ?? null : null,
        productId: spec.targetType === "product" ? hoodie.id : null,
        goal: spec.goal,
        startedAt: spec.startedDaysAgo !== null ? daysAgo(spec.startedDaysAgo) : null,
        endedAt: spec.endedDaysAgo !== null ? daysAgo(spec.endedDaysAgo) : null,
        isDemo: true,
        createdAt: daysAgo(spec.startedDaysAgo ?? 2),
        variants: {
          create: spec.variants.map((v) => ({
            name: v.name,
            isControl: v.isControl ?? false,
            weight: v.weight,
            changes: v.changes as Prisma.InputJsonValue,
          })),
        },
      },
      include: { variants: true },
    });

    if (spec.status === "DRAFT") continue;

    const runDays = (spec.startedDaysAgo ?? 0) - (spec.endedDaysAgo ?? 0);
    const events: Prisma.ExperimentEventCreateManyInput[] = [];
    let session = 0;
    for (let d = spec.startedDaysAgo!; d > (spec.endedDaysAgo ?? 0); d--) {
      const dayVisitors = Math.round(trafficForDay(d, rng) * 0.55);
      for (let v = 0; v < dayVisitors; v++) {
        const variantSpec = weightedVariant(rng, spec.variants);
        const variant = experiment.variants.find((x) => x.name === variantSpec.name)!;
        const sessionId = `exp-${experiment.id}-${session++}`;
        const at = daysAgo(d);
        at.setUTCHours(intBetween(rng, 6, 23), intBetween(rng, 0, 59));
        events.push({
          experimentId: experiment.id, variantId: variant.id, sessionId,
          type: "impression", isDemo: true, createdAt: at,
        });
        const baseRate = spec.goal === "purchase" ? 0.028 : 0.078;
        if (rng() < baseRate * variantSpec.lift) {
          events.push({
            experimentId: experiment.id, variantId: variant.id, sessionId,
            type: "conversion", value: round2(48 + rng() * 120), isDemo: true,
            createdAt: new Date(at.getTime() + 6e5),
          });
        }
      }
    }
    for (let i = 0; i < events.length; i += 1000) {
      await prisma.experimentEvent.createMany({ data: events.slice(i, i + 1000), skipDuplicates: true });
    }
    log(`  ${spec.name}: ${events.length} events over ${runDays} days`);

    if (spec.status === "COMPLETED") {
      const winner = experiment.variants.find((v) => v.name === "B");
      await prisma.experiment.update({
        where: { id: experiment.id },
        data: { winnerVariantId: winner?.id ?? null },
      });
    }
  }

  // -- email ---------------------------------------------------------------
  log("email");
  const subscriberRows: Prisma.EmailSubscriberCreateManyInput[] = customers
    .filter(() => rng() < 0.5)
    .map((c) => ({
      storeId, email: c.email, name: c.name, status: "subscribed",
      source: "storefront", isDemo: true, createdAt: c.createdAt,
    }));
  for (let i = 0; i < 54; i++) {
    const first = pick(rng, DEMO_FIRST_NAMES);
    subscriberRows.push({
      storeId,
      email: `${first.toLowerCase()}.list${i}@example.test`,
      name: first,
      status: rng() < 0.94 ? "subscribed" : "unsubscribed",
      source: pick(rng, ["storefront", "checkout", "popup", "import"]),
      isDemo: true,
      createdAt: daysAgo(intBetween(rng, 1, DAYS)),
    });
  }
  await prisma.emailSubscriber.createMany({ data: subscriberRows, skipDuplicates: true });

  const campaignSeeds = [
    {
      name: "Spring restock announcement", subject: "The fleece is back in every size",
      status: "SENT", sentDaysAgo: 34, openRate: 42.8, clickRate: 6.1,
      blocks: [
        { type: "heading", text: "Back in every size" },
        { type: "text", text: "The Essential Hoodie sold through in three weeks. It is back, in all three colours, and we made more of the sizes that went first." },
        { type: "product", productTitle: "Essential Hoodie" },
        { type: "button", label: "Shop the fleece", href: "/collections/fleece" },
      ],
    },
    {
      name: "Summer linen launch", subject: "Two new things for warm weather",
      status: "SENT", sentDaysAgo: 12, openRate: 39.4, clickRate: 5.2,
      blocks: [
        { type: "heading", text: "Linen, twice-washed" },
        { type: "text", text: "European flax, washed before cutting so it arrives soft. Two pieces, three colours between them." },
        { type: "button", label: "See what's new", href: "/collections/new-arrivals" },
      ],
    },
    {
      name: "Weekend promotion", subject: "20% off the fleece shop through Sunday",
      status: "SCHEDULED", sentDaysAgo: -3, openRate: null, clickRate: null,
      blocks: [
        { type: "heading", text: "20% off through Sunday" },
        { type: "text", text: "Use FLEECE20 at checkout. Applies to every hoodie and pullover." },
        { type: "button", label: "Shop now", href: "/collections/fleece" },
      ],
    },
    {
      name: "Abandoned cart follow-up", subject: "You left something behind",
      status: "DRAFT", sentDaysAgo: null, openRate: null, clickRate: null,
      blocks: [
        { type: "heading", text: "Still thinking it over?" },
        { type: "text", text: "Your cart is saved for seven days. Free returns for sixty, if you want to try it and see." },
        { type: "button", label: "Return to cart", href: "/cart" },
      ],
    },
  ];

  for (const c of campaignSeeds) {
    await prisma.emailCampaign.create({
      data: {
        storeId, name: c.name, subject: c.subject,
        previewText: c.subject, fromName: store.name,
        fromEmail: `hello@${store.slug}.test`, audience: "subscribers",
        status: c.status as never,
        blocks: c.blocks as Prisma.InputJsonValue,
        scheduledAt: c.sentDaysAgo !== null && c.sentDaysAgo < 0 ? daysAgo(c.sentDaysAgo) : null,
        sentAt: c.status === "SENT" ? daysAgo(c.sentDaysAgo!) : null,
        recipientCount: c.status === "SENT" ? subscriberRows.length : 0,
        openRate: c.openRate, clickRate: c.clickRate,
        isDemo: true,
        createdAt: daysAgo(Math.abs(c.sentDaysAgo ?? 5) + 3),
      },
    });
  }

  // -- media library -------------------------------------------------------
  const media = await prisma.productImage.findMany({
    where: { product: { storeId } },
    take: 40,
    orderBy: { position: "asc" },
  });
  await prisma.mediaAsset.createMany({
    data: media.map((image) => ({
      storeId,
      filename: image.url.split("/").pop() ?? "image.svg",
      url: image.url,
      mimeType: "image/svg+xml",
      size: 2400 + Math.round(rng() * 2000),
      width: 800,
      height: 800,
      alt: image.alt,
      isDemo: true,
    })),
    skipDuplicates: true,
  });

  // -- notifications -------------------------------------------------------
  const recentOrders = createdOrders.slice(-3);
  await prisma.notification.createMany({
    data: [
      ...recentOrders.map((o) => ({
        storeId,
        type: "new_order",
        title: `New order — $${o.total.toFixed(2)}`,
        body: `Placed via ${o.source}.`,
        href: `/admin/orders/${o.id}`,
        createdAt: o.createdAt,
      })),
      {
        storeId,
        type: "experiment_completed",
        title: "Experiment completed: Announcement bar offer",
        body: "Variant B finished ahead. Review the result and pick a winner.",
        href: "/admin/experiments",
        createdAt: daysAgo(24),
      },
      {
        storeId,
        type: "low_inventory",
        title: "Low stock on 3 variants",
        body: "Essential Hoodie and Six-Panel Cap have variants under 5 units.",
        href: "/admin/products",
        createdAt: daysAgo(1),
      },
    ],
  });

  log("done");
  return {
    products: products.length,
    orders: createdOrders.length,
    customers: customers.length,
    events: eventRows.length,
  };
}

function weightedVariant<T extends { weight: number }>(rng: Rng, variants: T[]): T {
  const total = variants.reduce((s, v) => s + v.weight, 0);
  let roll = rng() * total;
  for (const variant of variants) {
    roll -= variant.weight;
    if (roll <= 0) return variant;
  }
  return variants[0];
}
