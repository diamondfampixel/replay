import type { Metadata } from "next";
import { Star } from "lucide-react";
import { prisma, type Prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { DataToolbar, Pagination } from "@/components/admin/data-toolbar";
import { ReviewsTable } from "@/components/admin/reviews-table";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requireCapability("content:read");
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const perPage = 25;

  const where: Prisma.ReviewWhereInput = { storeId: auth.storeId };
  if (params.status) where.status = params.status as never;
  if (params.rating) where.rating = Number(params.rating);
  if (params.q) {
    where.OR = [
      { authorName: { contains: params.q, mode: "insensitive" } },
      { body: { contains: params.q, mode: "insensitive" } },
      { title: { contains: params.q, mode: "insensitive" } },
      { product: { title: { contains: params.q, mode: "insensitive" } } },
    ];
  }

  const [total, reviews, pending, products] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { product: { select: { id: true, title: true } } },
    }),
    prisma.review.count({ where: { storeId: auth.storeId, status: "PENDING" } }),
    prisma.product.findMany({
      where: { storeId: auth.storeId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Reviews"
        description={
          pending > 0
            ? `${total} review${total === 1 ? "" : "s"} · ${pending} awaiting moderation`
            : `${total} review${total === 1 ? "" : "s"}`
        }
      />

      <Card className="overflow-hidden">
        <DataToolbar
          searchPlaceholder="Search reviews, authors or products…"
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "PENDING", label: "Pending" },
                { value: "PUBLISHED", label: "Published" },
                { value: "HIDDEN", label: "Hidden" },
              ],
            },
            {
              key: "rating",
              label: "Rating",
              options: [5, 4, 3, 2, 1].map((rating) => ({
                value: String(rating),
                label: `${rating} star${rating === 1 ? "" : "s"}`,
              })),
            },
          ]}
        />

        {reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No reviews match"
            description="Reviews left on your storefront appear here for moderation before they are published."
          />
        ) : (
          <ReviewsTable
            canWrite={can(auth.role, "content:write")}
            products={products}
            reviews={reviews.map((review) => ({
              id: review.id,
              productId: review.product.id,
              productTitle: review.product.title,
              authorName: review.authorName,
              rating: review.rating,
              title: review.title,
              body: review.body,
              status: review.status,
              verified: review.verified,
              isDemo: review.isDemo,
              createdAt: review.createdAt.toISOString(),
            }))}
          />
        )}

        {total > perPage && (
          <Pagination
            page={page}
            pageCount={Math.ceil(total / perPage)}
            total={total}
            perPage={perPage}
          />
        )}
      </Card>

      <p className="mt-3 text-[12px] text-ink-400">
        Reviews marked as demo data were generated for development. Halyard will not create
        testimonials on your behalf — the assistant records only reviews you supply.
      </p>
    </div>
  );
}
