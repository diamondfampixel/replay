import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Card } from "@/components/ui/card";

import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";


import { SubscribersTable } from "@/components/admin/subscribers-table";

export const metadata: Metadata = { title: "Subscribers" };
export const dynamic = "force-dynamic";

export default async function SubscribersPage() {
  const auth = await requireCapability("marketing:read");

  const [subscribers, counts] = await Promise.all([
    prisma.emailSubscriber.findMany({
      where: { storeId: auth.storeId },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.emailSubscriber.groupBy({
      by: ["status"],
      where: { storeId: auth.storeId },
      _count: true,
    }),
  ]);

  const subscribed = counts.find((row) => row.status === "subscribed")?._count ?? 0;
  const unsubscribed = counts.find((row) => row.status === "unsubscribed")?._count ?? 0;

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/emails" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Emails
          </Link>
        }
        title="Subscribers"
        description={`${subscribed} subscribed · ${unsubscribed} unsubscribed`}
      />

      <Card className="overflow-hidden">
        {subscribers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No subscribers yet"
            description="The newsletter section on your storefront creates real subscribers here."
          />
        ) : (
          <SubscribersTable
            canWrite={can(auth.role, "marketing:write")}
            subscribers={subscribers.map((subscriber) => ({
              id: subscriber.id,
              email: subscriber.email,
              name: subscriber.name,
              status: subscriber.status,
              source: subscriber.source,
              isDemo: subscriber.isDemo,
              createdAt: subscriber.createdAt.toISOString(),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
