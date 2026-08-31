import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { UndoActionButton } from "@/components/admin/undo-button";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  EXECUTED: "success",
  FAILED: "danger",
  PENDING_CONFIRMATION: "warning",
  CANCELLED: "neutral",
  UNDONE: "neutral",
};

export default async function ActivityPage() {
  const ctx = await requireCapability("settings:read");

  const [aiActions, auditLogs] = await Promise.all([
    prisma.aIAction.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Activity"
        description="Everything the assistant did, and every change made through the admin."
      />

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI actions ({aiActions.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit log ({auditLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <Card className="overflow-hidden">
            {aiActions.length === 0 ? (
              <EmptyState
                icon={History}
                title="No AI actions yet"
                description="Ask the assistant to change something and every call it makes is recorded here with its parameters and result."
                action={{ label: "Open the assistant", href: "/admin/assistant" }}
              />
            ) : (
              <ul className="divide-y divide-ink-200">
                {aiActions.map((action) => {
                  const result = action.result as { summary?: string } | null;
                  const undoable = Boolean(action.undoData) && action.status === "EXECUTED";
                  return (
                    <li key={action.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-[12.5px] font-medium text-ink-900">{action.tool}</code>
                        <Badge tone={STATUS_TONE[action.status] ?? "neutral"}>
                          {action.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                        <Badge tone={action.riskLevel === "high" ? "warning" : "outline"}>
                          {action.riskLevel}
                        </Badge>
                        <span className="ml-auto text-[11.5px] text-ink-400">
                          {formatDate(action.createdAt, "datetime")}
                        </span>
                      </div>

                      {action.prompt && (
                        <p className="mt-1.5 text-[12.5px] italic text-ink-500">“{action.prompt}”</p>
                      )}
                      {result?.summary && <p className="mt-1 text-[13px] text-ink-700">{result.summary}</p>}
                      {action.error && (
                        <p className="mt-1 text-[13px] text-[var(--color-signal-negative)]">{action.error}</p>
                      )}

                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[11.5px] text-ink-400 hover:text-ink-700">
                          Parameters
                        </summary>
                        <pre className="scroll-thin mt-1 max-h-40 overflow-auto rounded border border-ink-200 bg-ink-50 p-2 text-[11px] text-ink-600">
                          {JSON.stringify(action.params, null, 2)}
                        </pre>
                      </details>

                      {undoable && (
                        <div className="mt-2">
                          <UndoActionButton actionId={action.id} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="overflow-hidden">
            {auditLogs.length === 0 ? (
              <EmptyState icon={History} title="No audit entries yet" />
            ) : (
              <ul className="divide-y divide-ink-200">
                {auditLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
                    <code className="font-mono text-[12.5px] text-ink-800">{log.action}</code>
                    <Badge tone={log.actor === "ai" ? "info" : "outline"}>{log.actor}</Badge>
                    {log.entityType && (
                      <span className="text-[12px] text-ink-500">
                        {log.entityType}
                        {log.entityId ? ` · ${log.entityId.slice(-6)}` : ""}
                      </span>
                    )}
                    <span className="text-[12px] text-ink-500">{log.user?.name ?? "System"}</span>
                    <span className="ml-auto text-[11.5px] text-ink-400">
                      {formatDate(log.createdAt, "datetime")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-[12px] text-ink-400">
        Analytics are computed from the <Link href="/admin/analytics" className="underline">order and event tables</Link>{" "}
        rather than stored aggregates, so these logs and your dashboards always agree.
      </p>
    </div>
  );
}
