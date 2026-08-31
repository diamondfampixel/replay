import { z } from "zod";
import { prisma, type Prisma } from "@/lib/db";
import { defineTool } from "@/lib/ai/types";
import { formatMoney } from "@/lib/money";
import { createDiscount, updateDiscount, deleteDiscount } from "@/lib/services/discounts";
import { createExperiment, setExperimentStatus, chooseWinner, getExperiment } from "@/lib/services/experiments";
import { testTypeMeta } from "@/lib/experiment-meta";
import { audit } from "@/lib/services/context";

export const marketingTools = [
  defineTool({
    name: "create_discount",
    description:
      "Create a discount code or automatic discount. Ask the caller for the value and duration if they have not said; do not guess a percentage.",
    schema: z.object({
      title: z.string().min(1).max(120).describe("Internal name"),
      code: z.string().max(40).optional().describe("Uppercase code customers type; omit for automatic"),
      automatic: z.boolean().default(false),
      type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING", "BUY_X_GET_Y"]).default("PERCENTAGE"),
      value: z.number().min(0).max(100000).default(0),
      minPurchase: z.number().min(0).nullable().optional(),
      usageLimit: z.number().int().min(1).nullable().optional(),
      scope: z.enum(["all", "products", "collections"]).default("all"),
      productIds: z.array(z.string()).max(200).default([]),
      collectionIds: z.array(z.string()).max(50).default([]),
      startsAt: z.string().optional().describe("ISO date-time; defaults to now"),
      endsAt: z.string().nullable().optional().describe("ISO date-time; omit to run indefinitely"),
      activate: z.boolean().default(false).describe("Set true to make it live immediately"),
    }),
    risk: "low",
    capability: "marketing:write",
    async escalate(input) {
      // Making a discount live is a change customers can act on.
      return input.activate;
    },
    async confirm(input) {
      const amount =
        input.type === "PERCENTAGE" ? `${input.value}% off`
        : input.type === "FIXED_AMOUNT" ? `${formatMoney(input.value)} off`
        : input.type === "FREE_SHIPPING" ? "free shipping"
        : "buy X get Y";

      return {
        title: `Activate ${input.code ?? input.title} on your live store?`,
        description: "Customers will be able to use this discount at checkout as soon as it is active.",
        details: [
          `Offer: ${amount}`,
          `Applies to: ${input.scope === "all" ? "everything" : `${input.scope === "products" ? input.productIds.length : input.collectionIds.length} selected ${input.scope}`}`,
          input.minPurchase ? `Minimum spend: ${formatMoney(input.minPurchase)}` : "No minimum spend",
          input.endsAt ? `Ends: ${new Date(input.endsAt).toLocaleString()}` : "No end date — runs until you stop it",
          input.usageLimit ? `Usage limit: ${input.usageLimit}` : "No usage limit",
        ],
        confirmLabel: "Activate discount",
      };
    },
    async execute(input, ctx) {
      const discount = await createDiscount(ctx, {
        title: input.title,
        code: input.code?.toUpperCase() ?? null,
        automatic: input.automatic,
        type: input.type,
        status: input.activate ? "ACTIVE" : "DRAFT",
        value: input.value,
        minPurchase: input.minPurchase ?? null,
        usageLimit: input.usageLimit ?? null,
        appliesToScope: input.scope,
        productIds: input.productIds,
        collectionIds: input.collectionIds,
        startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      });

      return {
        summary:
          `Created ${discount.code ?? discount.title} (${input.type === "PERCENTAGE" ? `${input.value}% off` : input.type.toLowerCase().replace(/_/g, " ")}) as ${input.activate ? "active" : "a draft"}` +
          (input.endsAt ? `, ending ${new Date(input.endsAt).toLocaleDateString()}.` : "."),
        data: { discountId: discount.id, code: discount.code, status: discount.status },
        links: [{ label: `Edit ${discount.code ?? discount.title}`, href: `/admin/discounts/${discount.id}` }],
        undo: { tool: "delete_discount", params: { discountId: discount.id } },
      };
    },
  }),

  defineTool({
    name: "update_discount",
    description: "Change a discount's value, schedule or status.",
    schema: z.object({
      discountId: z.string(),
      title: z.string().max(120).optional(),
      value: z.number().min(0).optional(),
      status: z.enum(["DRAFT", "ACTIVE", "DISABLED"]).optional(),
      endsAt: z.string().nullable().optional(),
    }),
    risk: "low",
    capability: "marketing:write",
    async escalate(input) {
      return input.status === "ACTIVE";
    },
    async confirm(input, ctx) {
      const discount = await prisma.discount.findFirst({
        where: { id: input.discountId, storeId: ctx.storeId },
      });
      return {
        title: `Activate ${discount?.code ?? discount?.title}?`,
        description: "Customers will be able to use this discount at checkout immediately.",
        confirmLabel: "Activate",
      };
    },
    async execute(input, ctx) {
      const { discountId, ...fields } = input;
      const provided = Object.fromEntries(
        Object.entries(fields)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => (key === "endsAt" && value ? [key, new Date(value as string)] : [key, value])),
      );
      const discount = await updateDiscount(ctx, discountId, provided);
      return {
        summary: `Updated ${discount.code ?? discount.title}.`,
        data: { discountId, changed: Object.keys(provided) },
        links: [{ label: "Discounts", href: `/admin/discounts/${discountId}` }],
      };
    },
  }),

  defineTool({
    name: "delete_discount",
    description: "Delete a discount permanently. Past orders keep their recorded discount; new checkouts will reject the code.",
    schema: z.object({ discountId: z.string() }),
    risk: "high",
    capability: "marketing:write",
    async confirm(input, ctx) {
      const discount = await prisma.discount.findFirst({
        where: { id: input.discountId, storeId: ctx.storeId },
      });
      return {
        title: `Delete ${discount?.code ?? discount?.title}?`,
        description: "Existing orders keep their recorded discount. New checkouts will reject this code.",
        details: discount ? [`Used ${discount.usageCount} times so far.`] : undefined,
        confirmLabel: "Delete discount",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      await deleteDiscount(ctx, input.discountId);
      return { summary: "Discount deleted.", data: { discountId: input.discountId } };
    },
  }),

  defineTool({
    name: "create_ab_test",
    description:
      "Create an A/B test as a draft. Provide the control (what is live today) as the first variant. Traffic weights must total 100.",
    schema: z.object({
      name: z.string().min(1).max(120),
      hypothesis: z.string().max(500).optional(),
      testType: z.enum([
        "headline", "hero", "cta", "section",
        "product_title", "product_description", "product_image", "price_display",
      ]),
      goal: z.enum(["purchase", "add_to_cart", "checkout_started", "email_signup"]).default("purchase"),
      pageSlug: z.string().optional().describe('Page to test; "homepage" for the home page'),
      sectionId: z.string().optional().describe("Section id from get_store_page"),
      productId: z.string().optional(),
      variants: z
        .array(
          z.object({
            name: z.string().max(4).describe('"A", "B", "C"…'),
            content: z.string().min(1).max(2000).describe("The copy or value for this variant"),
            weight: z.number().int().min(0).max(100),
          }),
        )
        .min(2)
        .max(6),
      start: z.boolean().default(false).describe("Set true to start serving traffic immediately"),
    }),
    risk: "low",
    capability: "experiments:write",
    async escalate(input) {
      return input.start;
    },
    async confirm(input) {
      return {
        title: `Start "${input.name}" on your live store?`,
        description:
          "Visitors will start seeing the variants immediately, split by the traffic weights below.",
        details: input.variants.map(
          (variant) => `${variant.name} (${variant.weight}%): ${variant.content.slice(0, 80)}`,
        ),
        confirmLabel: "Start test",
      };
    },
    async execute(input, ctx) {
      const meta = testTypeMeta(input.testType);
      const targetType = meta.target as "page" | "product";

      let pageId: string | null = null;
      let sectionId: string | null = input.sectionId ?? null;

      if (targetType === "page") {
        const page =
          !input.pageSlug || input.pageSlug === "homepage" || input.pageSlug === "home"
            ? await prisma.page.findFirst({ where: { storeId: ctx.storeId, type: "HOME" } })
            : await prisma.page.findFirst({ where: { storeId: ctx.storeId, slug: input.pageSlug } });
        if (!page) throw new Error(`No page found for "${input.pageSlug ?? "homepage"}".`);
        pageId = page.id;

        if (!sectionId) {
          // Default to the section the test type most naturally applies to.
          const preferred = input.testType === "cta" ? ["hero", "customBanner"] : ["hero", "imageHero"];
          const section = await prisma.pageSection.findFirst({
            where: { pageId: page.id, type: { in: preferred } },
            orderBy: { position: "asc" },
          });
          sectionId = section?.id ?? null;
        }
        if (!sectionId) throw new Error("Could not find a section to test. Call get_store_page and pass a sectionId.");
      }

      if (targetType === "product" && !input.productId) {
        throw new Error("This test type needs a productId.");
      }

      const experiment = await createExperiment(ctx, {
        name: input.name,
        hypothesis: input.hypothesis ?? null,
        testType: input.testType,
        targetType,
        pageId,
        sectionId,
        productId: targetType === "product" ? input.productId! : null,
        goal: input.goal,
        variants: input.variants.map((variant, index) => ({
          name: variant.name,
          isControl: index === 0,
          weight: variant.weight,
          changes: { [meta.field]: variant.content },
        })),
      });

      if (input.start) await setExperimentStatus(ctx, experiment.id, "RUNNING");

      return {
        summary:
          `Created "${experiment.name}" with ${input.variants.length} variants split ${input.variants.map((v) => `${v.weight}%`).join("/")}` +
          (input.start ? " and started it." : " as a draft. Start it when you are ready."),
        data: {
          experimentId: experiment.id,
          status: input.start ? "RUNNING" : "DRAFT",
          variants: experiment.variants.map((variant) => ({ id: variant.id, name: variant.name })),
        },
        links: [{ label: experiment.name, href: `/admin/experiments/${experiment.id}` }],
      };
    },
  }),

  defineTool({
    name: "set_ab_test_status",
    description: "Start, pause, stop or return an A/B test to draft. Starting it begins serving variants to real visitors.",
    schema: z.object({
      experimentId: z.string(),
      status: z.enum(["RUNNING", "PAUSED", "COMPLETED", "DRAFT"]),
    }),
    risk: "low",
    capability: "experiments:write",
    async escalate(input) {
      return input.status === "RUNNING";
    },
    async confirm(input, ctx) {
      const experiment = await getExperiment(ctx, input.experimentId);
      return {
        title: `Start "${experiment.name}"?`,
        description: "Visitors will begin seeing the variants immediately.",
        details: experiment.variants.map(
          (variant) => `${variant.name} (${variant.weight}%): ${Object.values(variant.changes as object)[0]}`,
        ),
        confirmLabel: "Start test",
      };
    },
    async execute(input, ctx) {
      await setExperimentStatus(ctx, input.experimentId, input.status);
      const verbs: Record<string, string> = {
        RUNNING: "started", PAUSED: "paused", COMPLETED: "stopped", DRAFT: "returned to draft",
      };
      return {
        summary: `Experiment ${verbs[input.status]}.`,
        data: { experimentId: input.experimentId, status: input.status },
        links: [{ label: "Experiment", href: `/admin/experiments/${input.experimentId}` }],
      };
    },
  }),

  defineTool({
    name: "choose_ab_test_winner",
    description:
      "Declare a winning variant and optionally write its copy onto the live store. Check get_ab_test first — do not declare a winner when the result is not significant unless the caller insists.",
    schema: z.object({
      experimentId: z.string(),
      variantId: z.string(),
      applyToStore: z.boolean().default(true),
    }),
    risk: "high",
    capability: "experiments:write",
    async confirm(input, ctx) {
      const experiment = await getExperiment(ctx, input.experimentId);
      const variant = experiment.results.variants.find((v) => v.id === input.variantId);
      return {
        title: `Declare variant ${variant?.name} the winner?`,
        description: input.applyToStore
          ? "This stops the experiment and writes the winning copy onto your live store."
          : "This stops the experiment and records the winner without changing the store.",
        details: [
          experiment.results.readiness,
          variant ? `Variant ${variant.name}: ${variant.conversionRate.toFixed(2)}% conversion over ${variant.visitors} visitors.` : "",
        ].filter(Boolean),
        confirmLabel: "Declare winner",
      };
    },
    async execute(input, ctx) {
      const result = await chooseWinner(ctx, input.experimentId, input.variantId, input.applyToStore);
      return {
        summary: result.applied
          ? `Variant ${result.variant.name} declared the winner and applied to the live store.`
          : `Variant ${result.variant.name} declared the winner. The change was not applied automatically.`,
        data: { experimentId: input.experimentId, applied: result.applied },
        links: [{ label: "Experiment", href: `/admin/experiments/${input.experimentId}` }],
      };
    },
  }),

  defineTool({
    name: "create_email_draft",
    description:
      "Create an email campaign as a draft. Drafts are never sent — sending requires a configured email provider and an explicit instruction.",
    schema: z.object({
      name: z.string().min(1).max(120),
      subject: z.string().min(1).max(160),
      previewText: z.string().max(200).optional(),
      audience: z.enum(["all", "subscribers", "customers"]).default("subscribers"),
      blocks: z
        .array(
          z.object({
            type: z.enum(["heading", "text", "image", "product", "button", "divider", "spacer"]),
            text: z.string().max(2000).optional(),
            label: z.string().max(80).optional(),
            href: z.string().max(300).optional(),
            imageUrl: z.string().max(500).optional(),
            productId: z.string().optional(),
          }),
        )
        .min(1)
        .max(20),
    }),
    risk: "low",
    capability: "marketing:write",
    async execute(input, ctx) {
      const store = await prisma.store.findUniqueOrThrow({
        where: { id: ctx.storeId },
        select: { name: true, slug: true, contactEmail: true },
      });

      const campaign = await prisma.emailCampaign.create({
        data: {
          storeId: ctx.storeId,
          name: input.name,
          subject: input.subject,
          previewText: input.previewText ?? null,
          fromName: store.name,
          fromEmail: store.contactEmail ?? `hello@${store.slug}.test`,
          audience: input.audience,
          status: "DRAFT",
          blocks: input.blocks as unknown as Prisma.InputJsonValue,
        },
      });

      const recipients = await prisma.emailSubscriber.count({
        where: { storeId: ctx.storeId, status: "subscribed" },
      });

      await audit(ctx, "campaign.create", { type: "EmailCampaign", id: campaign.id }, { name: campaign.name });

      return {
        summary: `Drafted "${input.name}" with the subject line "${input.subject}". It would reach ${recipients} subscribers when sent — nothing has been sent.`,
        data: { campaignId: campaign.id, blocks: input.blocks.length, potentialRecipients: recipients },
        links: [{ label: "Edit campaign", href: `/admin/emails/${campaign.id}` }],
        undo: { tool: "delete_email_campaign", params: { campaignId: campaign.id } },
      };
    },
  }),

  defineTool({
    name: "delete_email_campaign",
    description: "Delete an email campaign that has not been sent.",
    schema: z.object({ campaignId: z.string() }),
    risk: "low",
    capability: "marketing:write",
    async execute(input, ctx) {
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id: input.campaignId, storeId: ctx.storeId },
      });
      if (!campaign) throw new Error("That campaign does not exist in this store.");
      if (campaign.status === "SENT") throw new Error("A sent campaign cannot be deleted.");

      await prisma.emailCampaign.delete({ where: { id: input.campaignId } });
      await audit(ctx, "campaign.delete", { type: "EmailCampaign", id: input.campaignId });
      return { summary: `Deleted the campaign "${campaign.name}".`, data: { campaignId: input.campaignId } };
    },
  }),
];
