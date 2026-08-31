"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { updateNavigationAction } from "@/app/actions/store";

type Item = { label: string; href: string };

const BUILT_IN = [
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/collections" },
  { label: "Search", href: "/search" },
  { label: "Cart", href: "/cart" },
];

export function NavigationEditor({
  main, footer, pages, canWrite,
}: {
  main: Item[];
  footer: Item[];
  pages: Array<{ title: string; slug: string }>;
  canWrite: boolean;
}) {
  const [group, setGroup] = React.useState<"main" | "footer">("main");
  const [items, setItems] = React.useState<Record<"main" | "footer", Item[]>>({ main, footer });
  const [dirty, setDirty] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const router = useRouter();

  const current = items[group];
  const options = [...BUILT_IN, ...pages.map((page) => ({ label: page.title, href: `/pages/${page.slug}` }))];

  function update(next: Item[]) {
    setItems((prev) => ({ ...prev, [group]: next }));
    setDirty(true);
  }

  async function save() {
    setPending(true);
    try {
      const result = await updateNavigationAction(group, current);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setDirty(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Navigation</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-ink-500">Links in your storefront header and footer.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={group}
            onChange={(event) => setGroup(event.target.value as "main" | "footer")}
            className="h-8 w-auto text-[13px]"
            aria-label="Navigation group"
          >
            <option value="main">Header</option>
            <option value="footer">Footer</option>
          </Select>
          {canWrite && (
            <Button size="sm" variant="primary" onClick={save} loading={pending} disabled={!dirty}>
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {current.length === 0 && (
          <p className="rounded-md border border-dashed border-ink-300 px-3 py-6 text-center text-[13px] text-ink-400">
            No links in this menu.
          </p>
        )}

        {current.map((item, index) => (
          <div
            key={index}
            draggable={canWrite}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex === null || dragIndex === index) return;
              const next = [...current];
              const [moved] = next.splice(dragIndex, 1);
              next.splice(index, 0, moved);
              update(next);
              setDragIndex(null);
            }}
            className="flex items-center gap-2"
          >
            {canWrite && <GripVertical className="size-3.5 shrink-0 cursor-grab text-ink-300" />}
            <Input
              value={item.label}
              disabled={!canWrite}
              onChange={(event) =>
                update(current.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)))
              }
              className="h-8 max-w-40 text-[13px]"
              aria-label="Link label"
            />
            <Input
              value={item.href}
              disabled={!canWrite}
              onChange={(event) =>
                update(current.map((entry, i) => (i === index ? { ...entry, href: event.target.value } : entry)))
              }
              className="h-8 flex-1 font-mono text-[12.5px]"
              aria-label="Link URL"
            />
            {canWrite && (
              <button
                type="button"
                onClick={() => update(current.filter((_, i) => i !== index))}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                aria-label="Remove link"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}

        {canWrite && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {options
              .filter((option) => !current.some((item) => item.href === option.href))
              .map((option) => (
                <button
                  key={option.href}
                  type="button"
                  onClick={() => update([...current, option])}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1 text-[12px] text-ink-600 hover:bg-ink-50"
                >
                  <Plus className="size-3" />
                  {option.label}
                </button>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
