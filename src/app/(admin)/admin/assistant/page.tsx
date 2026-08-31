import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageSquarePlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { isAIConfigured } from "@/lib/ai/config";
import { loadMessages } from "@/lib/ai/conversation";
import { AssistantChat, type ChatMessage, type ChatToolCall, type PendingConfirmation } from "@/components/admin/assistant-chat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("ai:use");
  const params = await searchParams;

  const [conversations, aiConfigured] = await Promise.all([
    prisma.aIConversation.findMany({
      where: { storeId: ctx.storeId, userId: ctx.user.id },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, title: true, updatedAt: true },
    }),
    isAIConfigured(ctx.storeId),
  ]);

  const conversationId = params.c ?? null;
  const stored = conversationId
    ? await loadMessages(conversationId).catch(() => [])
    : [];

  const initialMessages: ChatMessage[] = stored.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant",
    content: message.content,
    toolCalls: (message.toolCalls ?? []) as ChatToolCall[],
    pending: message.pendingAction
      ? ({ ...(message.pendingAction as object), resolved: "confirmed" } as PendingConfirmation)
      : null,
  }));

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <Button asChild size="sm" variant="secondary" className="mb-3 w-full">
          <Link href="/admin/assistant">
            <MessageSquarePlus />
            New conversation
          </Link>
        </Button>
        <nav className="space-y-0.5">
          {conversations.length === 0 && (
            <p className="px-2 py-3 text-[12.5px] text-ink-400">No conversations yet.</p>
          )}
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/admin/assistant?c=${conversation.id}`}
              className={cn(
                "block truncate rounded-md px-2.5 py-2 text-[13px] transition-colors",
                conversationId === conversation.id
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              <span className="block truncate">{conversation.title}</span>
              <span
                className={cn(
                  "block text-[11px]",
                  conversationId === conversation.id ? "text-white/60" : "text-ink-400",
                )}
              >
                {relativeTime(conversation.updatedAt)}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      <Card className="overflow-hidden">
        <Suspense fallback={<div className="h-96 skeleton" />}>
          <AssistantChat
            key={conversationId ?? "new"}
            aiConfigured={aiConfigured}
            conversationId={conversationId}
            initialMessages={initialMessages}
            seedPrompt={params.prompt}
          />
        </Suspense>
      </Card>
    </div>
  );
}
