import { cn } from "@/lib/utils";

/**
 * Marketing-safe replicas of real Halyard admin surfaces, built on the same
 * design system the app uses. Every figure is the seeded Northwind demo brand
 * — no live queries, no customer data, nothing private ever renders here.
 */

export function WindowFrame({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-white text-ink-900 ring-1 ring-black/10",
        "shadow-[0_24px_60px_-18px_rgba(3,6,12,0.55)]",
        className,
      )}
    >
      {title !== undefined && (
        <div className="flex items-center gap-1.5 border-b border-ink-100 px-3 py-2">
          <span className="size-2 rounded-full bg-ink-200" />
          <span className="size-2 rounded-full bg-ink-200" />
          <span className="size-2 rounded-full bg-ink-200" />
          {title && <span className="ml-2 text-[10.5px] font-medium text-ink-400">{title}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function ProductCardDemo({ className }: { className?: string }) {
  return (
    <WindowFrame title="Products" className={className}>
      <div className="flex gap-3 p-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-md bg-pine-50">
          <div className="h-8 w-6 rounded-sm bg-pine-300/70" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[12.5px] font-semibold">Essential Hoodie</p>
            <span className="rounded-full bg-pine-50 px-1.5 py-0.5 text-[9.5px] font-medium text-pine-700">
              Active
            </span>
          </div>
          <p className="text-[11px] text-ink-500">$68.00 · 132 in stock</p>
          <div className="mt-1.5 flex gap-1">
            {["S", "M", "L", "XL"].map((size) => (
              <span key={size} className="rounded border border-ink-200 px-1.5 py-0.5 text-[9.5px] text-ink-600">
                {size}
              </span>
            ))}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

export function OrderToastDemo({ className, number = 4581, total = "$86.30" }: { className?: string; number?: number; total?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg bg-white px-3.5 py-2.5 text-ink-900 ring-1 ring-black/10",
        "shadow-[0_16px_40px_-14px_rgba(3,6,12,0.5)]",
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-pine-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-pine-500" />
      </span>
      <div>
        <p className="text-[11.5px] font-semibold leading-tight">New order #{number}</p>
        <p className="text-[10.5px] text-ink-700">{total} · 2 items · paid</p>
      </div>
    </div>
  );
}

export function RevenueChartDemo({ className }: { className?: string }) {
  return (
    <WindowFrame title="Analytics" className={className}>
      <div className="p-3">
        <p className="text-[10px] uppercase tracking-wide text-ink-400">Revenue · 30 days</p>
        <div className="flex items-baseline gap-2">
          <p className="text-[17px] font-semibold tracking-tight">$113,961</p>
          <span className="text-[10.5px] font-medium text-pine-600">↑ 38%</span>
        </div>
        <svg viewBox="0 0 160 44" className="mt-1 w-full" aria-hidden>
          <path
            d="M0 34 L14 28 L28 31 L42 20 L56 24 L70 12 L84 18 L98 10 L112 16 L126 8 L140 13 L160 4"
            fill="none"
            stroke="var(--color-pine-500)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M0 34 L14 28 L28 31 L42 20 L56 24 L70 12 L84 18 L98 10 L112 16 L126 8 L140 13 L160 4 L160 44 L0 44 Z"
            fill="var(--color-pine-500)"
            opacity="0.08"
          />
        </svg>
      </div>
    </WindowFrame>
  );
}

export function AssistantDemo({
  command,
  toolName,
  toolSummary,
  reply,
  className,
}: {
  command: string;
  toolName: string;
  toolSummary: string;
  reply: string;
  className?: string;
}) {
  return (
    <WindowFrame title="Assistant" className={className}>
      <div className="space-y-2 p-3">
        <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-ink-900 px-2.5 py-1.5 text-[11px] text-white">
          {command}
        </div>
        <div className="flex w-fit items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 px-2 py-1">
          <span className="size-1.5 rounded-full bg-pine-500" />
          <span className="font-mono text-[9.5px] text-ink-600">{toolName}</span>
          <span className="text-[9.5px] text-ink-400">· {toolSummary}</span>
        </div>
        <div className="w-fit max-w-[90%] rounded-lg rounded-bl-sm bg-ink-100 px-2.5 py-1.5 text-[11px] text-ink-800">
          {reply}
        </div>
      </div>
    </WindowFrame>
  );
}

export function ConfirmGateDemo({ className }: { className?: string }) {
  return (
    <WindowFrame className={className}>
      <div className="p-3.5">
        <p className="text-[12px] font-semibold">Change prices on 27 products?</p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">
          Every active product drops 15% for the weekend sale. This changes your live storefront.
        </p>
        <div className="mt-2.5 flex justify-end gap-1.5">
          <span className="rounded-md border border-ink-200 px-2.5 py-1 text-[10.5px] font-medium text-ink-600">
            Cancel
          </span>
          <span className="rounded-md bg-ink-900 px-2.5 py-1 text-[10.5px] font-medium text-white">
            Confirm change
          </span>
        </div>
      </div>
    </WindowFrame>
  );
}

export function ABTestDemo({ className }: { className?: string }) {
  return (
    <WindowFrame title="A/B testing" className={className}>
      <div className="space-y-2 p-3">
        <p className="text-[11.5px] font-semibold leading-tight">Homepage hero headline</p>
        {[
          { name: "A — control", value: 3.1, width: "46%", winner: false },
          { name: "B — challenger", value: 3.8, width: "58%", winner: true },
        ].map((variant) => (
          <div key={variant.name}>
            <div className="flex justify-between text-[9.5px] text-ink-500">
              <span>{variant.name}</span>
              <span className={variant.winner ? "font-semibold text-pine-600" : ""}>
                {variant.value}% conv
              </span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-ink-100">
              <div
                className={cn("h-full rounded-full", variant.winner ? "bg-pine-500" : "bg-ink-300")}
                style={{ width: variant.width }}
              />
            </div>
          </div>
        ))}
        <p className="text-[9.5px] font-medium text-pine-700">+21% · statistically significant</p>
      </div>
    </WindowFrame>
  );
}

export function StorefrontMiniDemo({ className }: { className?: string }) {
  return (
    <WindowFrame title="northwind.shop" className={className}>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wide">NORTHWIND</span>
          <div className="flex gap-2 text-[8.5px] text-ink-400">
            <span>Shop</span>
            <span>About</span>
            <span className="text-ink-700">Cart</span>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] font-semibold leading-tight tracking-tight">
          Everyday things,
          <br />
          built properly.
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {["bg-pine-100", "bg-amber-100", "bg-ink-100"].map((tone, index) => (
            <div key={index} className="space-y-1">
              <div className={cn("aspect-square rounded", tone)} />
              <div className="h-1 w-4/5 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </WindowFrame>
  );
}

export function CustomerDemo({ className }: { className?: string }) {
  return (
    <WindowFrame title="Customers" className={className}>
      <div className="space-y-1.5 p-3">
        {[
          { name: "M. Okafor", meta: "6 orders · $512 lifetime" },
          { name: "J. Laurent", meta: "2 orders · $141 lifetime" },
        ].map((customer) => (
          <div key={customer.name} className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-ink-100 text-[9px] font-semibold text-ink-600">
              {customer.name[0]}
            </span>
            <div>
              <p className="text-[10.5px] font-medium leading-tight">{customer.name}</p>
              <p className="text-[9px] text-ink-400">{customer.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}
