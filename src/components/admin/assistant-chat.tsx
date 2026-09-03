"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowUp, Check, Loader2, RotateCcw, Sparkles, Square, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChatToolCall = {
  id: string;
  name: string;
  status: "running" | "executed" | "failed" | "pending";
  risk?: string;
  summary?: string;
  error?: string;
  links?: Array<{ label: string; href: string }>;
  actionId?: string;
  undoable?: boolean;
  undone?: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCall[];
  /** Every action in this turn that is waiting for (or has had) a decision. */
  pendingActions?: PendingConfirmation[];
};

export type PendingConfirmation = {
  actionId: string;
  toolName: string;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  destructive?: boolean;
  resolved?: "confirmed" | "cancelled";
};

const SUGGESTIONS = [
  "How has the store done this week?",
  "What are my best performing products?",
  "Which A/B test is winning?",
  "Create a 20% discount code for the whole store",
  "Add a black hoodie for $60 as a draft",
  "Change the homepage hero to focus on free shipping",
];

export function AssistantChat({
  aiConfigured,
  conversationId: initialConversationId,
  initialMessages = [],
  seedPrompt,
  variant = "page",
}: {
  aiConfigured: boolean;
  conversationId?: string | null;
  initialMessages?: ChatMessage[];
  seedPrompt?: string;
  variant?: "page" | "panel";
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = React.useState<string | null>(initialConversationId ?? null);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const seeded = React.useRef(false);

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  React.useEffect(scrollToBottom, [messages, scrollToBottom]);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", toolCalls: [] },
      ]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      function patch(update: (message: ChatMessage) => ChatMessage) {
        setMessages((prev) => prev.map((message) => (message.id === assistantId ? update(message) : message)));
      }

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, conversationId }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({ error: "The assistant is unavailable." }));
          patch((message) => ({ ...message, content: data.error ?? "The assistant is unavailable." }));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const eventLine = chunk.split("\n").find((line) => line.startsWith("event: "));
            const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
            if (!eventLine || !dataLine) continue;

            const event = eventLine.slice(7).trim();
            const data = JSON.parse(dataLine.slice(6));

            if (event === "start") {
              setConversationId(data.conversationId);
            } else if (event === "text") {
              patch((message) => ({
                ...message,
                content: message.content ? `${message.content}\n\n${data.text}` : data.text,
              }));
            } else if (event === "tool_start") {
              patch((message) => ({
                ...message,
                toolCalls: [
                  ...(message.toolCalls ?? []),
                  { id: data.id, name: data.name, status: "running", risk: data.risk },
                ],
              }));
            } else if (event === "tool_result") {
              patch((message) => ({
                ...message,
                toolCalls: (message.toolCalls ?? []).map((call) =>
                  call.id === data.id
                    ? {
                        ...call,
                        status: data.status,
                        summary: data.summary,
                        error: data.error,
                        links: data.links,
                        actionId: data.actionId,
                        undoable: data.undoable,
                        risk: data.risk ?? call.risk,
                      }
                    : call,
                ),
              }));
            } else if (event === "confirmation_required") {
              patch((message) => ({ ...message, pendingActions: [...(message.pendingActions ?? []), data as PendingConfirmation] }));
            } else if (event === "error") {
              patch((message) => ({
                ...message,
                content: message.content || `Something went wrong: ${data.error}`,
              }));
              toast.error(data.error);
            } else if (event === "done") {
              router.refresh();
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          patch((message) => ({ ...message, content: message.content || "The connection dropped." }));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, streaming, router],
  );

  React.useEffect(() => {
    if (!seedPrompt || seeded.current || !aiConfigured) return;
    seeded.current = true;
    send(seedPrompt);
  }, [seedPrompt, send, aiConfigured]);

  async function resolveConfirmation(
    messageId: string,
    actionId: string,
    decision: "confirm" | "cancel",
  ) {
    const response = await fetch("/api/ai/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, decision }),
    });
    const data = await response.json();

    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId || !message.pendingActions?.length) return message;
        const resolved = decision === "confirm" ? "confirmed" : "cancelled";
        return {
          ...message,
          pendingActions: message.pendingActions.map((p) => (p.actionId === actionId ? { ...p, resolved } : p)),
          toolCalls: (message.toolCalls ?? []).map((call) =>
            call.actionId === actionId
              ? {
                  ...call,
                  status: decision === "cancel" ? "failed" : data.status === "executed" ? "executed" : "failed",
                  summary: data.summary,
                  error: decision === "cancel" ? "Cancelled by you" : data.error,
                  links: data.links,
                  undoable: data.undoable,
                }
              : call,
          ),
        };
      }),
    );

    if (decision === "confirm") {
      if (data.status === "executed") toast.success(data.summary ?? "Done");
      else toast.error(data.error ?? "Could not complete that action");
    }
    router.refresh();
  }

  async function undo(messageId: string, actionId: string) {
    const response = await fetch("/api/ai/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, decision: "undo" }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Could not undo that");
      return;
    }
    toast.success("Reverted");
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              toolCalls: (message.toolCalls ?? []).map((call) =>
                call.actionId === actionId ? { ...call, undone: true, undoable: false } : call,
              ),
            }
          : message,
      ),
    );
    router.refresh();
  }

  return (
    <div className={cn("flex min-h-0 flex-col", variant === "page" ? "h-[calc(100dvh-8.5rem)]" : "h-full")}>
      {variant === "panel" && (
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-200 px-4">
          <Sparkles className="size-4 text-pine-600" />
          <span className="text-[14px] font-semibold text-ink-900">Assistant</span>
        </div>
      )}

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-5">
          {!aiConfigured && (
            <div className="rounded-lg border border-[#f0dfb8] bg-[#fdf6e7] px-4 py-3.5 text-[13px] text-[#7a4e07]">
              <p className="font-medium">The assistant is not configured.</p>
              <p className="mt-1">
                Add an Anthropic API key under{" "}
                <Link href="/admin/integrations/anthropic" className="underline">Integrations → Anthropic</Link>, or
                set <code className="rounded bg-white/60 px-1">ANTHROPIC_API_KEY</code> on the server. Everything
                else in Halyard works without it.
              </p>
            </div>
          )}

          {messages.length === 0 && aiConfigured && (
            <div className="pt-6">
              <div className="mb-1.5 flex items-center gap-2">
                <Sparkles className="size-4 text-pine-600" />
                <h2 className="text-[16px] font-semibold text-ink-900">What would you like to do?</h2>
              </div>
              <p className="mb-5 text-[13.5px] text-ink-500">
                I can read your business data and make changes for you. Anything that touches your live
                store, pricing or money will ask you to confirm first.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-md border border-ink-200 bg-white px-3 py-2.5 text-left text-[13px] text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onConfirm={(actionId, decision) => resolveConfirmation(message.id, actionId, decision)}
              onUndo={(actionId) => undo(message.id, actionId)}
            />
          ))}

          {streaming && (
            <div className="flex items-center gap-2.5 text-[13px] text-ink-400">
              <span className="thinking-dots" aria-hidden>
                <span /><span /><span />
              </span>
              Working…
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-ink-200 bg-white px-4 py-3">
        <form
          className="mx-auto flex max-w-3xl items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              disabled={!aiConfigured}
              placeholder={aiConfigured ? "Ask about your business, or tell me what to change…" : "Configure an API key to use the assistant"}
              className="scroll-thin max-h-40 w-full resize-none rounded-md border border-ink-200 py-2.5 pl-3 pr-11 text-[14px] outline-none transition-colors focus:border-ink-400 disabled:bg-ink-50"
              style={{ minHeight: 42 }}
            />
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="absolute bottom-2 right-2 rounded-md bg-ink-200 p-1.5 text-ink-700 hover:bg-ink-300"
                aria-label="Stop"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !aiConfigured}
                className="absolute bottom-2 right-2 rounded-md bg-ink-900 p-1.5 text-white transition-opacity hover:bg-ink-800 disabled:opacity-30"
                aria-label="Send"
              >
                <ArrowUp className="size-3.5" />
              </button>
            )}
          </div>
        </form>
        <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-ink-400">
          The assistant acts on your real store. High-impact changes always ask before running.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message, onConfirm, onUndo,
}: {
  message: ChatMessage;
  onConfirm: (actionId: string, decision: "confirm" | "cancel") => void | Promise<void>;
  onUndo: (actionId: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-ink-900 px-3.5 py-2.5 text-[14px] leading-relaxed text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {(message.toolCalls ?? []).map((call) => (
        <ToolCallRow key={call.id} call={call} onUndo={onUndo} />
      ))}

      {message.content && (
        <div className="max-w-[92%] whitespace-pre-wrap text-[14px] leading-relaxed text-ink-800">
          {message.content}
        </div>
      )}

      {message.pendingActions && message.pendingActions.length > 0 && (
        <ConfirmationList pending={message.pendingActions} onDecision={onConfirm} />
      )}
    </div>
  );
}

function ToolCallRow({ call, onUndo }: { call: ChatToolCall; onUndo: (actionId: string) => void }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-[12.5px]",
        call.status === "failed"
          ? "border-[#f5cec6] bg-[#fdeeeb]"
          : call.status === "running"
            ? "border-ink-200 bg-ink-50"
            : "border-ink-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {call.status === "running" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-400" />
        ) : call.status === "failed" ? (
          <AlertTriangle className="size-3.5 shrink-0 text-[var(--color-signal-negative)]" />
        ) : call.status === "pending" ? (
          <AlertTriangle className="size-3.5 shrink-0 text-[var(--color-signal-warning)]" />
        ) : (
          <Check className="size-3.5 shrink-0 text-pine-600" />
        )}
        <code className="font-mono text-[11.5px] text-ink-500">{call.name}</code>
        {call.risk === "high" && <Badge tone="warning">needs approval</Badge>}
        {call.undone && <Badge tone="neutral">undone</Badge>}
      </div>

      {call.summary && <p className="mt-1 text-ink-700">{call.summary}</p>}
      {call.error && <p className="mt-1 text-[#8c2817]">{call.error}</p>}

      {(call.links?.length || call.undoable) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          {call.links?.map((link) => (
            <Link key={link.href} href={link.href} className="text-[12px] font-medium text-pine-700 hover:underline">
              {link.label} →
            </Link>
          ))}
          {call.undoable && call.actionId && (
            <button
              type="button"
              onClick={() => onUndo(call.actionId!)}
              className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
            >
              <RotateCcw className="size-3" />
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One card per action waiting on the operator, plus "Approve all" when a
 * redesign queued several. Approving runs them in the order the assistant
 * proposed them; each still resolves individually.
 */
function ConfirmationList({ pending, onDecision }: { pending: PendingConfirmation[]; onDecision: (actionId: string, decision: "confirm" | "cancel") => void | Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  const open = pending.filter((p) => !p.resolved);
  return (
    <div className="space-y-2">
      {open.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[13px] text-ink-700">
          <span>{open.length} changes are waiting for your approval. Review each below, or approve them together.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setBusy(true); for (const p of open) onDecision(p.actionId, "cancel"); }}>Cancel all</Button>
            <Button size="sm" variant="primary" loading={busy} onClick={async () => { setBusy(true); for (const p of open) { await onDecision(p.actionId, "confirm"); } }}>Approve all {open.length}</Button>
          </div>
        </div>
      )}
      {pending.map((p) => <ConfirmationCard key={p.actionId} pending={p} onDecision={onDecision} />)}
    </div>
  );
}

function ConfirmationCard({
  pending, onDecision,
}: {
  pending: PendingConfirmation;
  onDecision: (actionId: string, decision: "confirm" | "cancel") => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  if (pending.resolved) {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[13px] text-ink-600">
        {pending.resolved === "confirmed" ? "You approved this action." : "You cancelled this action."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3.5",
        pending.destructive ? "border-[#f5cec6] bg-[#fdeeeb]" : "border-[#f0dfb8] bg-[#fdf6e7]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className={cn(
            "mt-0.5 size-4 shrink-0",
            pending.destructive ? "text-[#8c2817]" : "text-[#a1660a]",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink-900">{pending.title}</p>
          <p className="mt-1 text-[13px] text-ink-700">{pending.description}</p>

          {pending.details && pending.details.length > 0 && (
            <ul className="mt-2.5 space-y-1 rounded-md border border-black/5 bg-white/70 px-3 py-2 text-[12.5px] text-ink-700">
              {pending.details.map((detail, index) => (
                <li key={index} className="flex gap-1.5">
                  <span className="text-ink-400">·</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onDecision(pending.actionId, "cancel");
              }}
            >
              <X />
              Cancel
            </Button>
            <Button
              size="sm"
              variant={pending.destructive ? "danger" : "primary"}
              loading={busy}
              onClick={() => {
                setBusy(true);
                onDecision(pending.actionId, "confirm");
              }}
            >
              {pending.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
