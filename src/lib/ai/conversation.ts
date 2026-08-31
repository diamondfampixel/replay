import "server-only";
import { prisma, type Prisma } from "@/lib/db";

export type StoredToolCall = {
  id: string;
  name: string;
  input: unknown;
  status: "executed" | "failed" | "pending" | "cancelled";
  summary?: string;
  error?: string;
  links?: Array<{ label: string; href: string }>;
  actionId?: string;
  risk?: string;
};

export type PendingAction = {
  actionId: string;
  toolName: string;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  destructive?: boolean;
};

export async function getOrCreateConversation(
  storeId: string,
  userId: string,
  conversationId?: string | null,
) {
  if (conversationId) {
    const existing = await prisma.aIConversation.findFirst({
      where: { id: conversationId, storeId, userId },
    });
    if (existing) return existing;
  }
  return prisma.aIConversation.create({
    data: { storeId, userId, title: "New conversation" },
  });
}

export async function loadMessages(conversationId: string, limit = 40) {
  return prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  extras: { toolCalls?: StoredToolCall[]; pendingAction?: PendingAction | null } = {},
) {
  return prisma.aIMessage.create({
    data: {
      conversationId,
      role,
      content,
      toolCalls: (extras.toolCalls ?? undefined) as Prisma.InputJsonValue | undefined,
      pendingAction: (extras.pendingAction ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Names a conversation from its first user message. */
export async function ensureTitle(conversationId: string, firstMessage: string) {
  const conversation = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.title !== "New conversation") return;

  const title = firstMessage.trim().replace(/\s+/g, " ").slice(0, 60);
  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: { title: title || "New conversation" },
  });
}

export async function touchConversation(conversationId: string) {
  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
