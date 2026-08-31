"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CornerDownLeft, Loader2, Search, Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NavIcon } from "@/components/admin/icon";
import { ADMIN_NAV } from "@/lib/nav";
import { can, type Capability } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/lib/services/search";

type CommandBarContextValue = { open: (initialQuery?: string) => void };

const CommandBarContext = React.createContext<CommandBarContextValue>({ open: () => {} });

export function useCommandBar() {
  return React.useContext(CommandBarContext);
}

type Row =
  | { kind: "nav"; label: string; href: string; icon: string; group: string }
  | { kind: "hit"; hit: SearchHit }
  | { kind: "ai"; prompt: string }
  | { kind: "action"; label: string; href: string; group: string };

const QUICK_ACTIONS: Array<{ label: string; href: string; keywords: string }> = [
  { label: "Create product", href: "/admin/products/new", keywords: "new product add item" },
  { label: "Create discount", href: "/admin/discounts/new", keywords: "new discount promo code sale" },
  { label: "Create collection", href: "/admin/collections/new", keywords: "new collection group" },
  { label: "Create A/B test", href: "/admin/experiments/new", keywords: "new experiment split test" },
  { label: "Create email campaign", href: "/admin/emails/new", keywords: "new campaign newsletter" },
  { label: "Create content page", href: "/admin/content/new", keywords: "new page about faq" },
  { label: "Edit storefront", href: "/admin/store/editor", keywords: "customize theme sections homepage" },
];

/**
 * The command bar answers three things: navigate somewhere, jump to a record,
 * or hand the sentence to the assistant. Anything phrased as a question goes to
 * the assistant.
 */
function looksLikeQuestion(value: string) {
  const v = value.trim().toLowerCase();
  if (v.endsWith("?")) return true;
  return /^(what|why|how|when|which|who|show me|tell me|can you|make|write|create a|draft|summari[sz]e|compare|is |are |did |do i)/.test(v);
}

export function CommandBarProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);

  const open = React.useCallback((initial?: string) => {
    setQuery(initial ?? "");
    setCursor(0);
    setIsOpen(true);
  }, []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced record search. Short queries are filtered out when rendering
  // rather than by clearing state, so no effect writes state synchronously.
  React.useEffect(() => {
    if (!isOpen || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { hits: SearchHit[] };
          setHits(data.hits);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  const navItems = React.useMemo(
    () =>
      ADMIN_NAV.flatMap((group) =>
        group.items
          .filter((item) => !item.capability || can(role, item.capability as Capability))
          .map((item) => ({ ...item, group: group.label ?? "Navigate" })),
      ),
    [role],
  );

  const rows = React.useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const result: Row[] = [];

    if (q && looksLikeQuestion(query)) {
      result.push({ kind: "ai", prompt: query.trim() });
    }

    const matchedNav = navItems.filter((item) => !q || item.label.toLowerCase().includes(q));
    for (const item of matchedNav.slice(0, q ? 5 : 20)) {
      result.push({ kind: "nav", label: item.label, href: item.href, icon: item.icon, group: item.group });
    }

    const matchedActions = QUICK_ACTIONS.filter(
      (action) => q && (action.label.toLowerCase().includes(q) || action.keywords.includes(q)),
    );
    for (const action of matchedActions.slice(0, 5)) {
      result.push({ kind: "action", label: action.label, href: action.href, group: "Actions" });
    }

    // Stale results from a previous, longer query must not leak through.
    if (q.length >= 2) for (const hit of hits) result.push({ kind: "hit", hit });

    if (q && !looksLikeQuestion(query)) {
      result.push({ kind: "ai", prompt: query.trim() });
    }
    return result;
  }, [query, navItems, hits]);

  // Reset the highlighted row whenever the candidate list changes.
  const [cursorKey, setCursorKey] = React.useState(query);
  if (cursorKey !== query) {
    setCursorKey(query);
    setCursor(0);
  }

  const go = React.useCallback(
    (row: Row) => {
      setIsOpen(false);
      if (row.kind === "ai") {
        router.push(`/admin/assistant?prompt=${encodeURIComponent(row.prompt)}`);
        return;
      }
      router.push(row.kind === "hit" ? row.hit.href : row.href);
    },
    [router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[cursor];
      if (row) go(row);
    }
  }

  let lastGroup = "";

  return (
    <CommandBarContext.Provider value={{ open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent size="lg" className="top-[15%] translate-y-0 p-0">
          <DialogTitle className="sr-only">Command bar</DialogTitle>
          <div className="flex items-center gap-2 border-b border-ink-200 px-4">
            <Search className="size-4 shrink-0 text-ink-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search products, orders, customers — or ask the assistant"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
            {loading && <Loader2 className="size-4 shrink-0 animate-spin text-ink-400" />}
          </div>

          <div className="scroll-thin max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {rows.length === 0 && (
              <p className="px-3 py-8 text-center text-[13px] text-ink-500">
                No matches. Press Enter to ask the assistant instead.
              </p>
            )}
            {rows.map((row, index) => {
              const group =
                row.kind === "hit"
                  ? "Records"
                  : row.kind === "ai"
                    ? "Assistant"
                    : row.group;
              const showGroup = group !== lastGroup;
              lastGroup = group;
              const active = index === cursor;

              return (
                <React.Fragment key={`${row.kind}-${index}`}>
                  {showGroup && (
                    <p className="px-2 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                      {group}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px]",
                      active ? "bg-ink-100 text-ink-900" : "text-ink-700",
                    )}
                  >
                    {row.kind === "ai" ? (
                      <Sparkles className="size-3.5 shrink-0 text-pine-600" />
                    ) : row.kind === "nav" ? (
                      <NavIcon name={row.icon} className="size-3.5 shrink-0 text-ink-400" />
                    ) : (
                      <ArrowRight className="size-3.5 shrink-0 text-ink-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {row.kind === "ai" ? (
                        <>
                          Ask the assistant: <span className="text-ink-900">{row.prompt}</span>
                        </>
                      ) : row.kind === "hit" ? (
                        <>
                          {row.hit.title}
                          {row.hit.subtitle && (
                            <span className="ml-2 text-ink-400">{row.hit.subtitle}</span>
                          )}
                        </>
                      ) : (
                        row.label
                      )}
                    </span>
                    {row.kind === "hit" && (
                      <span className="shrink-0 rounded border border-ink-200 bg-ink-50 px-1.5 py-px text-[10px] uppercase tracking-wide text-ink-500">
                        {row.hit.type}
                      </span>
                    )}
                    {active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-400" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </CommandBarContext.Provider>
  );
}
