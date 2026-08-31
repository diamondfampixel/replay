import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAIConfig } from "@/lib/ai/config";
import { createAnthropic, providerErrorMessage } from "@/lib/ai/client";
import { SYSTEM_PROMPT, buildStoreContext } from "@/lib/ai/context";
import { toAnthropicTools, toolsForRole, getTool } from "@/lib/ai/registry";
import { executeTool } from "@/lib/ai/executor";
import {
  appendMessage, ensureTitle, getOrCreateConversation, loadMessages, touchConversation,
  type PendingAction, type StoredToolCall,
} from "@/lib/ai/conversation";
import { apiContext, clientErrorMessage } from "@/lib/services/context";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional().nullable(),
});

const MAX_TOOL_ROUNDS = 8;

export async function POST(request: Request) {
  const ctx = await apiContext({ actor: "ai" });
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limit = rateLimit(`ai:${ctx.userId}`, { limit: 40, windowMs: 5 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const config = await getAIConfig(ctx.storeId);
  if (!config) {
    return NextResponse.json(
      {
        error:
          "The AI assistant is not configured. Add an Anthropic API key under Integrations, or set ANTHROPIC_API_KEY on the server.",
        code: "AI_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const conversation = await getOrCreateConversation(ctx.storeId, ctx.userId!, parsed.data.conversationId);
  await appendMessage(conversation.id, "user", parsed.data.message);
  await ensureTitle(conversation.id, parsed.data.message);

  const history = await loadMessages(conversation.id);
  const storeContext = await buildStoreContext(ctx.storeId);
  const availableTools = toolsForRole(ctx.role);
  const anthropic = createAnthropic(config);

  // Replay the transcript as plain user/assistant turns. Tool traffic from
  // earlier turns is summarised rather than replayed, which keeps the context
  // small and avoids stale tool_use/tool_result pairing.
  const messages: Anthropic.MessageParam[] = [];
  for (const message of history) {
    if (message.role === "user") {
      messages.push({ role: "user", content: message.content });
      continue;
    }
    const calls = (message.toolCalls ?? []) as StoredToolCall[];
    const summary = calls.length
      ? `${message.content}\n\n[Actions taken: ${calls.map((call) => `${call.name} — ${call.summary ?? call.error ?? call.status}`).join("; ")}]`
      : message.content;
    if (summary.trim()) messages.push({ role: "assistant", content: summary });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      const toolCalls: StoredToolCall[] = [];
      let pendingAction: PendingAction | null = null;
      let finalText = "";

      try {
        send("start", { conversationId: conversation.id });

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await anthropic.messages.create({
            model: config.model,
            max_tokens: 4096,
            system: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "text", text: `## The store you are operating\n\n${storeContext}` },
            ],
            tools: toAnthropicTools(availableTools),
            messages,
          });

          const textBlocks = response.content.filter(
            (block): block is Anthropic.TextBlock => block.type === "text",
          );
          const toolUses = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );

          const text = textBlocks.map((block) => block.text).join("\n").trim();
          if (text) {
            finalText = finalText ? `${finalText}\n\n${text}` : text;
            send("text", { text });
          }

          if (!toolUses.length) break;

          messages.push({ role: "assistant", content: response.content });
          const results: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUses) {
            const definition = getTool(toolUse.name);
            send("tool_start", {
              id: toolUse.id,
              name: toolUse.name,
              risk: definition?.risk ?? "read",
              input: toolUse.input,
            });

            const outcome = await executeTool(toolUse.name, toolUse.input, ctx, {
              conversationId: conversation.id,
              prompt: parsed.data.message,
            });

            if (outcome.status === "executed") {
              toolCalls.push({
                id: toolUse.id,
                name: toolUse.name,
                input: toolUse.input,
                status: "executed",
                summary: outcome.result.summary,
                links: outcome.result.links,
                actionId: outcome.actionId,
                risk: outcome.risk,
              });
              send("tool_result", {
                id: toolUse.id,
                name: toolUse.name,
                status: "executed",
                summary: outcome.result.summary,
                links: outcome.result.links,
                actionId: outcome.actionId,
                undoable: Boolean(outcome.result.undo),
                risk: outcome.risk,
              });
              results.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({ summary: outcome.result.summary, data: outcome.result.data }).slice(0, 24000),
              });
            } else if (outcome.status === "needs_confirmation") {
              pendingAction = {
                actionId: outcome.actionId,
                toolName: toolUse.name,
                title: outcome.confirmation.title,
                description: outcome.confirmation.description,
                details: outcome.confirmation.details,
                confirmLabel: outcome.confirmation.confirmLabel,
                destructive: outcome.confirmation.destructive,
              };
              toolCalls.push({
                id: toolUse.id,
                name: toolUse.name,
                input: toolUse.input,
                status: "pending",
                actionId: outcome.actionId,
                risk: outcome.risk,
              });
              send("confirmation_required", pendingAction);
              results.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content:
                  "This action needs the operator's approval. A confirmation prompt is now on screen. Tell them briefly what you are about to do and stop — do not retry the tool.",
              });
            } else {
              toolCalls.push({
                id: toolUse.id,
                name: toolUse.name,
                input: toolUse.input,
                status: "failed",
                error: outcome.error,
              });
              send("tool_result", {
                id: toolUse.id,
                name: toolUse.name,
                status: "failed",
                error: outcome.error,
              });
              results.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Error: ${outcome.error}`,
                is_error: true,
              });
            }
          }

          messages.push({ role: "user", content: results });

          // Once something is waiting on a human, let the model close its turn
          // and stop rather than pushing further changes.
          if (pendingAction) {
            const closing = await anthropic.messages.create({
              model: config.model,
              max_tokens: 512,
              system: SYSTEM_PROMPT,
              messages,
            });
            const closingText = closing.content
              .filter((block): block is Anthropic.TextBlock => block.type === "text")
              .map((block) => block.text)
              .join("\n")
              .trim();
            if (closingText) {
              finalText = finalText ? `${finalText}\n\n${closingText}` : closingText;
              send("text", { text: closingText });
            }
            break;
          }
        }

        await appendMessage(conversation.id, "assistant", finalText, { toolCalls, pendingAction });
        await touchConversation(conversation.id);
        send("done", { conversationId: conversation.id });
      } catch (error) {
        console.error("[api/ai/chat]", error);
        const message =
          providerErrorMessage(error) ??
          clientErrorMessage(error, "The assistant could not complete that request.");
        send("error", { error: message });
        await appendMessage(
          conversation.id,
          "assistant",
          finalText || `I hit an error: ${message}`,
          { toolCalls },
        ).catch(() => undefined);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
