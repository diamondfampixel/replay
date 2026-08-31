import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/lib/ai/types";
import { formatMoney, round2, toNumber } from "@/lib/money";
import { resolveRange } from "@/lib/ranges";
import {
  getConversionFunnel, getOverviewMetrics, getTopProducts, getTrafficSources,
} from "@/lib/services/analytics";
import { listProducts, getProduct, getProductStats } from "@/lib/services/products";
import { listCollections, getCollectionProducts } from "@/lib/services/collections";
import { listOrders, getOrder } from "@/lib/services/orders";
import { listCustomers } from "@/lib/services/customers";
import { listDiscounts } from "@/lib/services/discounts";
import { listExperiments, getExperiment } from "@/lib/services/experiments";
import { searchBusinessData } from "@/lib/services/search";
import { summariseSection } from "@/lib/storefront/sections";

const rangeSchema = z
  .enum(["today", "yesterday", "7d", "30d", "90d", "12m"])
  .default("30d")
  .describe("Reporting window");

export const readTools = [
  defineTool({
    name: "get_store_overview",
    description:
      "Headline business numbers for a period: revenue, orders, visitors, conversion rate, average order value, units and refunds, each with the change versus the previous equivalent period.",
    schema: z.object({ range: rangeSchema }),
    risk: "read",
    capability: "analytics:read",
    async execute(input, ctx) {
      const range = resolveRange(input.range);
      const [metrics, store] = await Promise.all([
        getOverviewMetrics(ctx.storeId, range),
        prisma.store.findUniqueOrThrow({
          where: { id: ctx.storeId },
          select: { name: true, currency: true, status: true, isDemo: true },
        }),
      ]);

      return {
        summary: `${store.name} made ${formatMoney(metrics.revenue.value, store.currency)} from ${metrics.orders.value} orders over the ${range.label.toLowerCase()}.`,
        data: {
          store: { name: store.name, currency: store.currency, status: store.status, containsDemoData: store.isDemo },
          period: range.label,
          revenue: metrics.revenue,
          orders: metrics.orders,
          visitors: metrics.visitors,
          sessions: metrics.sessions,
          conversionRatePercent: metrics.conversionRate,
          averageOrderValue: metrics.averageOrderValue,
          unitsSold: metrics.unitsSold,
          newCustomers: metrics.newCustomers,
          refunds: metrics.refunds,
        },
        links: [{ label: "Open dashboard", href: "/admin" }],
      };
    },
  }),

  defineTool({
    name: "get_analytics",
    description:
      "Detailed analytics for a period: the conversion funnel, traffic by source, and sales totals. Use when the question is about traffic, funnel steps or channel performance.",
    schema: z.object({
      range: rangeSchema,
      include: z
        .array(z.enum(["funnel", "sources", "sales"]))
        .default(["funnel", "sources", "sales"])
        .describe("Which breakdowns to return"),
    }),
    risk: "read",
    capability: "analytics:read",
    async execute(input, ctx) {
      const range = resolveRange(input.range);
      const wanted = new Set(input.include);

      const [metrics, funnel, sources] = await Promise.all([
        wanted.has("sales") ? getOverviewMetrics(ctx.storeId, range) : null,
        wanted.has("funnel") ? getConversionFunnel(ctx.storeId, range) : null,
        wanted.has("sources") ? getTrafficSources(ctx.storeId, range) : null,
      ]);

      return {
        summary: `Analytics for the ${range.label.toLowerCase()}.`,
        data: {
          period: range.label,
          ...(metrics && {
            sales: {
              grossSales: metrics.grossSales.value,
              netSales: metrics.netSales.value,
              revenue: metrics.revenue.value,
              discounts: metrics.discounts.value,
              refunds: metrics.refunds.value,
              orders: metrics.orders.value,
              unitsSold: metrics.unitsSold.value,
              averageOrderValue: metrics.averageOrderValue.value,
            },
          }),
          ...(funnel && { funnel }),
          ...(sources && { trafficSources: sources }),
        },
        links: [{ label: "Analytics", href: "/admin/analytics" }],
      };
    },
  }),

  defineTool({
    name: "get_top_products",
    description: "Best performing products by revenue for a period, with units, orders and revenue.",
    schema: z.object({
      range: rangeSchema,
      limit: z.number().int().min(1).max(25).default(5),
    }),
    risk: "read",
    capability: "analytics:read",
    async execute(input, ctx) {
      const range = resolveRange(input.range);
      const [products, store] = await Promise.all([
        getTopProducts(ctx.storeId, range, input.limit),
        prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
      ]);

      if (!products.length) {
        return { summary: `No product sales in the ${range.label.toLowerCase()}.`, data: { products: [] } };
      }
      return {
        summary: `${products[0].title} led with ${formatMoney(products[0].revenue, store.currency)} over the ${range.label.toLowerCase()}.`,
        data: { period: range.label, products },
        links: [{ label: "Product analytics", href: "/admin/analytics/products" }],
      };
    },
  }),

  defineTool({
    name: "list_products",
    description:
      "List products with optional search, status filter and sorting. Use this to find a product's id before updating it.",
    schema: z.object({
      query: z.string().max(120).optional().describe("Search title, SKU, description or vendor"),
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
      sort: z.enum(["updated", "title", "price_asc", "price_desc", "inventory", "revenue"]).default("updated"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    risk: "read",
    capability: "catalog:read",
    async execute(input, ctx) {
      const result = await listProducts(ctx, {
        q: input.query,
        status: input.status,
        sort: input.sort,
        perPage: input.limit,
      });
      return {
        summary: `${result.total} product${result.total === 1 ? "" : "s"} matched.`,
        data: {
          total: result.total,
          products: result.rows.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            price: row.price,
            inventory: row.inventory,
            variants: row.variantCount,
            unitsSold: row.unitsSold,
            revenue: row.revenue,
            tags: row.tags,
          })),
        },
        links: [{ label: "Products", href: "/admin/products" }],
      };
    },
  }),

  defineTool({
    name: "get_product",
    description:
      "Full detail for one product including description, variants, images, collections and its sales and review performance.",
    schema: z.object({ productId: z.string().describe("Product id from list_products") }),
    risk: "read",
    capability: "catalog:read",
    async execute(input, ctx) {
      const [product, stats] = await Promise.all([
        getProduct(ctx, input.productId),
        getProductStats(ctx.storeId, input.productId),
      ]);

      return {
        summary: `${product.title} — ${stats.unitsSold} units sold, ${stats.reviewCount} reviews.`,
        data: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          status: product.status,
          description: product.description,
          price: toNumber(product.price),
          compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
          cost: product.cost ? toNumber(product.cost) : null,
          inventory: product.inventory,
          tags: product.tags,
          vendor: product.vendor,
          imageCount: product.images.length,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            title: variant.title,
            price: variant.price ? toNumber(variant.price) : null,
            inventory: variant.inventory,
          })),
          collections: product.collections.map((link) => link.collection.title),
          performance: stats,
        },
        links: [{ label: product.title, href: `/admin/products/${product.id}` }],
      };
    },
  }),

  defineTool({
    name: "list_collections",
    description: "All collections with their type (manual or rule-based) and product counts.",
    schema: z.object({}),
    risk: "read",
    capability: "catalog:read",
    async execute(_input, ctx) {
      const collections = await listCollections(ctx);
      return {
        summary: `${collections.length} collection${collections.length === 1 ? "" : "s"}.`,
        data: collections.map((collection) => ({
          id: collection.id,
          title: collection.title,
          slug: collection.slug,
          type: collection.type,
          visible: collection.visible,
          productCount: collection.productCount,
        })),
        links: [{ label: "Collections", href: "/admin/collections" }],
      };
    },
  }),

  defineTool({
    name: "get_collection",
    description: "One collection with the products currently in it.",
    schema: z.object({ collectionId: z.string() }),
    risk: "read",
    capability: "catalog:read",
    async execute(input, ctx) {
      const collection = await prisma.collection.findFirst({
        where: { id: input.collectionId, storeId: ctx.storeId },
      });
      if (!collection) throw new Error("That collection does not exist in this store.");
      const products = await getCollectionProducts(ctx.storeId, collection, { limit: 50 });

      return {
        summary: `${collection.title} contains ${products.length} product${products.length === 1 ? "" : "s"}.`,
        data: {
          id: collection.id,
          title: collection.title,
          type: collection.type,
          rules: collection.rules,
          products: products.map((product) => ({ id: product.id, title: product.title })),
        },
        links: [{ label: collection.title, href: `/admin/collections/${collection.id}` }],
      };
    },
  }),

  defineTool({
    name: "list_orders",
    description: "Recent orders, optionally filtered by payment or fulfillment status.",
    schema: z.object({
      query: z.string().max(120).optional().describe("Search order number or email"),
      paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"]).optional(),
      fulfillmentStatus: z.enum(["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"]).optional(),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    risk: "read",
    capability: "orders:read",
    async execute(input, ctx) {
      const result = await listOrders(ctx, {
        q: input.query,
        paymentStatus: input.paymentStatus,
        fulfillmentStatus: input.fulfillmentStatus,
        perPage: input.limit,
      });
      return {
        summary: `${result.total} order${result.total === 1 ? "" : "s"} matched.`,
        data: {
          total: result.total,
          orders: result.rows.map((order) => ({
            id: order.id,
            number: order.number,
            email: order.email,
            total: order.total,
            paymentStatus: order.paymentStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            placedAt: order.createdAt,
          })),
        },
        links: [{ label: "Orders", href: "/admin/orders" }],
      };
    },
  }),

  defineTool({
    name: "get_order",
    description: "Full detail for one order: items, totals, addresses, payments and timeline.",
    schema: z.object({ orderId: z.string() }),
    risk: "read",
    capability: "orders:read",
    async execute(input, ctx) {
      const order = await getOrder(ctx, input.orderId);
      return {
        summary: `Order #${order.number} — ${formatMoney(toNumber(order.total), order.currency)}, ${order.paymentStatus.toLowerCase()}.`,
        data: {
          id: order.id,
          number: order.number,
          email: order.email,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          subtotal: toNumber(order.subtotal),
          discountTotal: toNumber(order.discountTotal),
          total: toNumber(order.total),
          refundedTotal: toNumber(order.refundedTotal),
          items: order.items.map((item) => ({
            title: item.title,
            variant: item.variantTitle,
            quantity: item.quantity,
            unitPrice: toNumber(item.unitPrice),
          })),
          timeline: order.events.map((event) => ({ type: event.type, message: event.message, at: event.createdAt })),
        },
        links: [{ label: `Order #${order.number}`, href: `/admin/orders/${order.id}` }],
      };
    },
  }),

  defineTool({
    name: "list_customers",
    description: "Customers with order counts and lifetime spend.",
    schema: z.object({
      query: z.string().max(120).optional(),
      sort: z.enum(["newest", "name", "spent_desc", "orders_desc"]).default("spent_desc"),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    risk: "read",
    capability: "customers:read",
    async execute(input, ctx) {
      const result = await listCustomers(ctx, {
        q: input.query,
        sort: input.sort,
        perPage: input.limit,
      });
      return {
        summary: `${result.total} customer${result.total === 1 ? "" : "s"} matched.`,
        data: {
          total: result.total,
          customers: result.rows.map((customer) => ({
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            email: customer.email,
            orders: customer.orders,
            totalSpent: customer.totalSpent,
            lastOrderAt: customer.lastOrderAt,
          })),
        },
        links: [{ label: "Customers", href: "/admin/customers" }],
      };
    },
  }),

  defineTool({
    name: "list_discounts",
    description: "All discounts with their type, value, effective status and usage.",
    schema: z.object({}),
    risk: "read",
    capability: "marketing:read",
    async execute(_input, ctx) {
      const discounts = await listDiscounts(ctx);
      return {
        summary: `${discounts.length} discount${discounts.length === 1 ? "" : "s"}.`,
        data: discounts.map((discount) => ({
          id: discount.id,
          title: discount.title,
          code: discount.code,
          type: discount.type,
          value: toNumber(discount.value),
          status: discount.effectiveStatus,
          usageCount: discount.usageCount,
          startsAt: discount.startsAt,
          endsAt: discount.endsAt,
        })),
        links: [{ label: "Discounts", href: "/admin/discounts" }],
      };
    },
  }),

  defineTool({
    name: "list_ab_tests",
    description:
      "All A/B tests with their current results: visitors, conversions, rate, uplift and whether the difference is statistically significant.",
    schema: z.object({
      status: z.enum(["DRAFT", "RUNNING", "PAUSED", "COMPLETED"]).optional(),
    }),
    risk: "read",
    capability: "experiments:read",
    async execute(input, ctx) {
      const experiments = await listExperiments(ctx);
      const filtered = input.status
        ? experiments.filter((experiment) => experiment.status === input.status)
        : experiments;

      return {
        summary: `${filtered.length} experiment${filtered.length === 1 ? "" : "s"}.`,
        data: filtered.map((experiment) => ({
          id: experiment.id,
          name: experiment.name,
          status: experiment.status,
          testType: experiment.testType,
          goal: experiment.goal,
          totalVisitors: experiment.results.totalVisitors,
          leader: experiment.results.leader?.name ?? null,
          statisticallySignificant: experiment.results.significant,
          readiness: experiment.results.readiness,
          variants: experiment.results.variants.map((variant) => ({
            name: variant.name,
            isControl: variant.isControl,
            content: Object.values(variant.changes)[0],
            visitors: variant.visitors,
            conversions: variant.conversions,
            conversionRate: variant.conversionRate,
            upliftVsControl: variant.upliftVsControl,
            pValue: variant.pValue,
          })),
        })),
        links: [{ label: "A/B Testing", href: "/admin/experiments" }],
      };
    },
  }),

  defineTool({
    name: "get_ab_test",
    description: "One A/B test in full, including per-variant results, uplift and the honest significance read.",
    schema: z.object({ experimentId: z.string() }),
    risk: "read",
    capability: "experiments:read",
    async execute(input, ctx) {
      const experiment = await getExperiment(ctx, input.experimentId);
      return {
        summary: `${experiment.name} — ${experiment.status.toLowerCase()}. ${experiment.results.readiness}`,
        data: {
          id: experiment.id,
          name: experiment.name,
          status: experiment.status,
          hypothesis: experiment.hypothesis,
          goal: experiment.goal,
          results: experiment.results,
        },
        links: [{ label: experiment.name, href: `/admin/experiments/${experiment.id}` }],
      };
    },
  }),

  defineTool({
    name: "get_store_settings",
    description:
      "The store's configuration: name, status, currency, brand colours, contact details, checkout mode, tax and shipping settings, and which integrations are connected.",
    schema: z.object({}),
    risk: "read",
    capability: "settings:read",
    async execute(_input, ctx) {
      const store = await prisma.store.findUniqueOrThrow({
        where: { id: ctx.storeId },
        include: { settings: true, integrations: true },
      });

      return {
        summary: `${store.name} is ${store.status.toLowerCase()}, selling in ${store.currency}.`,
        data: {
          name: store.name,
          status: store.status,
          currency: store.currency,
          timezone: store.timezone,
          domain: store.domain,
          contactEmail: store.contactEmail,
          description: store.description,
          industry: store.industry,
          targetCustomer: store.targetCustomer,
          brandPersonality: store.brandPersonality,
          primaryColor: store.primaryColor,
          checkoutMode: store.settings?.checkoutMode ?? "simulated",
          taxEnabled: store.settings?.taxEnabled ?? false,
          connectedIntegrations: store.integrations
            .filter((integration) => integration.status === "CONNECTED")
            .map((integration) => integration.provider),
        },
        links: [{ label: "Settings", href: "/admin/settings" }],
      };
    },
  }),

  defineTool({
    name: "get_store_page",
    description:
      "The sections that make up a storefront page, with each section's type, position, visibility and configuration. Use before editing a section.",
    schema: z.object({
      page: z.string().default("homepage").describe('"homepage" or a page slug such as "about"'),
    }),
    risk: "read",
    capability: "storefront:read",
    async execute(input, ctx) {
      const page =
        input.page === "homepage" || input.page === "home"
          ? await prisma.page.findFirst({
              where: { storeId: ctx.storeId, type: "HOME" },
              include: { sections: { orderBy: { position: "asc" } } },
            })
          : await prisma.page.findFirst({
              where: { storeId: ctx.storeId, slug: input.page },
              include: { sections: { orderBy: { position: "asc" } } },
            });

      if (!page) throw new Error(`No page found for "${input.page}".`);

      return {
        summary: `${page.title} has ${page.sections.length} section${page.sections.length === 1 ? "" : "s"}.`,
        data: {
          pageId: page.id,
          title: page.title,
          slug: page.slug,
          type: page.type,
          published: page.published,
          sections: page.sections.map((section) => ({
            id: section.id,
            type: section.type,
            position: section.position,
            visible: section.visible,
            summary: summariseSection(section.type, (section.config ?? {}) as Record<string, unknown>),
            config: section.config,
          })),
        },
        links: [{ label: "Store editor", href: "/admin/store/editor" }],
      };
    },
  }),

  defineTool({
    name: "list_reviews",
    description: "Product reviews, optionally filtered by product or moderation status.",
    schema: z.object({
      productId: z.string().optional(),
      status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]).optional(),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    risk: "read",
    capability: "content:read",
    async execute(input, ctx) {
      const reviews = await prisma.review.findMany({
        where: {
          storeId: ctx.storeId,
          ...(input.productId ? { productId: input.productId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { product: { select: { title: true } } },
      });

      return {
        summary: `${reviews.length} review${reviews.length === 1 ? "" : "s"}.`,
        data: reviews.map((review) => ({
          id: review.id,
          product: review.product.title,
          author: review.authorName,
          rating: review.rating,
          title: review.title,
          body: review.body,
          status: review.status,
          isDemo: review.isDemo,
        })),
        links: [{ label: "Reviews", href: "/admin/reviews" }],
      };
    },
  }),

  defineTool({
    name: "search_business_data",
    description:
      "Search across products, orders, customers, collections, pages, discounts and experiments at once. Use when you do not know which entity the user means.",
    schema: z.object({ query: z.string().min(1).max(120) }),
    risk: "read",
    capability: "catalog:read",
    async execute(input, ctx) {
      const hits = await searchBusinessData(ctx.storeId, input.query, 5);
      return {
        summary: `${hits.length} match${hits.length === 1 ? "" : "es"} for "${input.query}".`,
        data: hits,
      };
    },
  }),

  defineTool({
    name: "get_inventory_status",
    description: "Products and variants that are low on stock or out of stock.",
    schema: z.object({ threshold: z.number().int().min(0).max(1000).default(5) }),
    risk: "read",
    capability: "catalog:read",
    async execute(input, ctx) {
      const [products, variants] = await Promise.all([
        prisma.product.findMany({
          where: {
            storeId: ctx.storeId,
            status: "ACTIVE",
            trackInventory: true,
            inventory: { lte: input.threshold },
          },
          select: { id: true, title: true, inventory: true },
          orderBy: { inventory: "asc" },
          take: 40,
        }),
        prisma.productVariant.findMany({
          where: {
            product: { storeId: ctx.storeId, status: "ACTIVE", trackInventory: true },
            inventory: { lte: input.threshold },
          },
          select: { id: true, title: true, inventory: true, product: { select: { title: true } } },
          orderBy: { inventory: "asc" },
          take: 40,
        }),
      ]);

      return {
        summary: `${products.length} products and ${variants.length} variants at or below ${input.threshold} units.`,
        data: {
          products,
          variants: variants.map((variant) => ({
            id: variant.id,
            product: variant.product.title,
            variant: variant.title,
            inventory: variant.inventory,
          })),
        },
        links: [{ label: "Low stock", href: "/admin/products?stock=low" }],
      };
    },
  }),

  defineTool({
    name: "get_revenue_series",
    description:
      "Daily revenue, orders and visitors across a period. Use when asked how something trended rather than for a single total.",
    schema: z.object({ range: rangeSchema }),
    risk: "read",
    capability: "analytics:read",
    async execute(input, ctx) {
      const range = resolveRange(input.range);
      const rows = await prisma.analyticsDaily.findMany({
        where: { storeId: ctx.storeId, date: { gte: range.from, lt: range.to } },
        orderBy: { date: "asc" },
        select: { date: true, visitors: true, sessions: true, orders: true, netSales: true },
      });

      return {
        summary: `Daily series for the ${range.label.toLowerCase()} (${rows.length} days).`,
        data: rows.map((row) => ({
          date: row.date.toISOString().slice(0, 10),
          visitors: row.visitors,
          sessions: row.sessions,
          orders: row.orders,
          netSales: round2(toNumber(row.netSales)),
        })),
      };
    },
  }),
];
