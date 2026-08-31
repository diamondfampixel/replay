import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  getDeviceBreakdown, getTimeseries, getTrafficSources, resolveRange,
} from "@/lib/services/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart, TrendChart } from "@/components/admin/charts";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { formatMoney, formatNumber } from "@/lib/money";

export default async function TrafficAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [sources, devices, series, store, campaigns] = await Promise.all([
    getTrafficSources(ctx.storeId, range),
    getDeviceBreakdown(ctx.storeId, range),
    getTimeseries(ctx.storeId, range),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
    prisma.order.groupBy({
      by: ["utmCampaign"],
      where: {
        storeId: ctx.storeId,
        utmCampaign: { not: null },
        createdAt: { gte: range.from, lt: range.to },
      },
      _count: true,
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
  ]);
  const totalSessions = sources.reduce((sum, row) => sum + row.sessions, 0);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader><CardTitle>Visitors over time</CardTitle></CardHeader>
        <CardContent className="pl-1">
          <TrendChart data={series} dataKey="visitors" name="Visitors" color="var(--color-chart-3)" height={230} />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <CardHeader><CardTitle>Sessions by source</CardTitle></CardHeader>
          {sources.length === 0 ? (
            <EmptyState title="No sessions recorded in this period" />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Source</TH>
                    <TH align="right">Sessions</TH>
                    <TH align="right">Share</TH>
                    <TH align="right">Orders</TH>
                    <TH align="right">Conversion</TH>
                    <TH align="right">Revenue</TH>
                  </tr>
                </THead>
                <TBody>
                  {sources.map((row) => (
                    <TR key={row.source}>
                      <TD className="capitalize font-medium text-ink-900">{row.source}</TD>
                      <TD align="right" className="tabular">{formatNumber(row.sessions)}</TD>
                      <TD align="right" className="tabular text-ink-500">
                        {totalSessions ? `${((row.sessions / totalSessions) * 100).toFixed(1)}%` : "—"}
                      </TD>
                      <TD align="right" className="tabular">{formatNumber(row.orders)}</TD>
                      <TD align="right" className="tabular">{row.conversionRate.toFixed(2)}%</TD>
                      <TD align="right" className="tabular font-medium text-ink-900">
                        {formatMoney(row.revenue, store.currency)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Device</CardTitle></CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <EmptyState title="No device data yet" />
            ) : (
              <DonutChart data={devices.map((row) => ({ name: row.device, value: row.sessions }))} height={180} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <span className="text-[12.5px] text-ink-500">Orders carrying a utm_campaign</span>
        </CardHeader>
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaign-attributed orders"
            description="Add utm_campaign to your links and attributed orders will appear here."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Campaign</TH>
                  <TH align="right">Orders</TH>
                  <TH align="right">Revenue</TH>
                </tr>
              </THead>
              <TBody>
                {campaigns.map((row) => (
                  <TR key={row.utmCampaign}>
                    <TD className="font-medium text-ink-900">{row.utmCampaign}</TD>
                    <TD align="right" className="tabular">{row._count}</TD>
                    <TD align="right" className="tabular">
                      {formatMoney(Number(row._sum.total ?? 0), store.currency)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
