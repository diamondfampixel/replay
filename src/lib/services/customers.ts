import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { round2, toNumber } from "@/lib/money";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { customerInputSchema, customerListParamsSchema, addressSchema } from "@/lib/validation/commerce";

export async function listCustomers(ctx: ServiceContext, rawParams: Record<string, unknown> = {}) {
  authorize(ctx, "customers:read");
  const params = customerListParamsSchema.parse(rawParams);

  const where: Prisma.CustomerWhereInput = { storeId: ctx.storeId };
  if (params.q) {
    where.OR = [
      { email: { contains: params.q, mode: "insensitive" } },
      { firstName: { contains: params.q, mode: "insensitive" } },
      { lastName: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.tag) where.tags = { has: params.tag };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: params.sort === "name" ? [{ firstName: "asc" }] : { createdAt: "desc" },
      // Spend-based sorts need aggregates, so they are applied after loading.
      skip: params.sort === "spent_desc" || params.sort === "orders_desc" ? 0 : (params.page - 1) * params.perPage,
      take: params.sort === "spent_desc" || params.sort === "orders_desc" ? 1000 : params.perPage,
      select: {
        id: true, firstName: true, lastName: true, email: true, tags: true,
        createdAt: true, isDemo: true, acceptsMarketing: true,
      },
    }),
  ]);

  const ids = customers.map((c) => c.id);
  const aggregates = ids.length
    ? await prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids }, storeId: ctx.storeId },
        _sum: { total: true, refundedTotal: true },
        _count: true,
        _max: { createdAt: true },
      })
    : [];
  const statsById = new Map(
    aggregates.map((row) => [
      row.customerId!,
      {
        orders: row._count,
        totalSpent: round2(toNumber(row._sum.total) - toNumber(row._sum.refundedTotal)),
        lastOrderAt: row._max.createdAt,
      },
    ]),
  );

  let rows = customers.map((customer) => ({
    ...customer,
    ...(statsById.get(customer.id) ?? { orders: 0, totalSpent: 0, lastOrderAt: null as Date | null }),
  }));

  if (params.sort === "spent_desc") rows.sort((a, b) => b.totalSpent - a.totalSpent);
  if (params.sort === "orders_desc") rows.sort((a, b) => b.orders - a.orders);
  if (params.sort === "spent_desc" || params.sort === "orders_desc") {
    rows = rows.slice((params.page - 1) * params.perPage, params.page * params.perPage);
  }

  return {
    rows,
    total,
    page: params.page,
    perPage: params.perPage,
    pageCount: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

export async function getCustomer(ctx: ServiceContext, id: string) {
  authorize(ctx, "customers:read");
  const customer = await prisma.customer.findFirst({
    where: { id, storeId: ctx.storeId },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, number: true, total: true, refundedTotal: true, createdAt: true,
          paymentStatus: true, fulfillmentStatus: true, _count: { select: { items: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { product: { select: { id: true, title: true } } },
      },
    },
  });
  if (!customer) throw new NotFoundError("Customer");

  const orders = customer.orders;
  const totalSpent = round2(
    orders.reduce((sum, order) => sum + toNumber(order.total) - toNumber(order.refundedTotal), 0),
  );

  return {
    ...customer,
    stats: {
      orderCount: orders.length,
      totalSpent,
      averageOrderValue: orders.length ? round2(totalSpent / orders.length) : 0,
      firstOrderAt: orders.at(-1)?.createdAt ?? null,
      lastOrderAt: orders[0]?.createdAt ?? null,
    },
  };
}

export async function createCustomer(ctx: ServiceContext, raw: unknown) {
  authorize(ctx, "customers:write");
  const input = customerInputSchema.parse(raw);

  const existing = await prisma.customer.findFirst({
    where: { storeId: ctx.storeId, email: input.email },
  });
  if (existing) {
    throw new ValidationError("A customer with that email already exists.", {
      email: "Already in your customer list.",
    });
  }

  const customer = await prisma.customer.create({
    data: { storeId: ctx.storeId, ...input },
  });
  await audit(ctx, "customer.create", { type: "Customer", id: customer.id }, { email: customer.email });
  return customer;
}

export async function updateCustomer(ctx: ServiceContext, id: string, raw: unknown) {
  authorize(ctx, "customers:write");
  const existing = await prisma.customer.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Customer");

  const input = customerInputSchema.partial().parse(raw);
  const customer = await prisma.customer.update({ where: { id }, data: input });
  await audit(ctx, "customer.update", { type: "Customer", id });
  return customer;
}

export async function upsertCustomerAddress(ctx: ServiceContext, customerId: string, raw: unknown, addressId?: string) {
  authorize(ctx, "customers:write");
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId: ctx.storeId } });
  if (!customer) throw new NotFoundError("Customer");

  const input = addressSchema.parse(raw);
  const data = {
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
  };

  if (addressId) {
    return prisma.address.update({ where: { id: addressId }, data });
  }
  const count = await prisma.address.count({ where: { customerId } });
  return prisma.address.create({
    data: { customerId, label: "shipping", isDefault: count === 0, ...data },
  });
}

export async function deleteCustomer(ctx: ServiceContext, id: string) {
  authorize(ctx, "customers:write");
  const result = await prisma.customer.deleteMany({ where: { id, storeId: ctx.storeId } });
  if (!result.count) throw new NotFoundError("Customer");
  await audit(ctx, "customer.delete", { type: "Customer", id });
  return true;
}

/** Finds or creates the customer behind a storefront checkout. */
export async function resolveCustomerForCheckout(
  storeId: string,
  email: string,
  name: { firstName: string; lastName: string },
  acceptsMarketing: boolean,
) {
  const normalised = email.trim().toLowerCase();
  const existing = await prisma.customer.findFirst({ where: { storeId, email: normalised } });
  if (existing) {
    if (acceptsMarketing && !existing.acceptsMarketing) {
      return prisma.customer.update({ where: { id: existing.id }, data: { acceptsMarketing: true } });
    }
    return existing;
  }
  return prisma.customer.create({
    data: {
      storeId,
      email: normalised,
      firstName: name.firstName || normalised.split("@")[0],
      lastName: name.lastName,
      acceptsMarketing,
    },
  });
}

export async function getCustomerTags(storeId: string) {
  const rows = await prisma.customer.findMany({ where: { storeId }, select: { tags: true } });
  return [...new Set(rows.flatMap((row) => row.tags))].sort();
}
