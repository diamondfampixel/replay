"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, GripVertical, Image as ImageIcon, Minus, MoveVertical, Package,
  Send, Trash2, Type, Heading, MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { ImageField } from "@/components/admin/media-picker";
import { ConfirmDialog } from "@/components/admin/confirm";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { EmailBlock } from "@/lib/services/email";
import {
  createCampaignAction, deleteCampaignAction, sendCampaignAction, updateCampaignAction,
} from "@/app/actions/marketing";

const BLOCK_TYPES: Array<{ type: EmailBlock["type"]; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: "heading", label: "Heading", icon: Heading },
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "product", label: "Product", icon: Package },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: MoveVertical },
];

function blankBlock(type: EmailBlock["type"]): EmailBlock {
  switch (type) {
    case "heading": return { type, text: "A heading" };
    case "text": return { type, text: "" };
    case "image": return { type, imageUrl: "", alt: "" };
    case "product": return { type };
    case "button": return { type, label: "Shop now", href: "/shop" };
    case "spacer": return { type, size: "medium" };
    default: return { type: "divider" };
  }
}

export type CampaignFormValues = {
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  audience: string;
  blocks: EmailBlock[];
};


export function CampaignEditor({
  campaignId, initial, status, sentAt, recipientCount, audienceCount,
  products, currency, providerConnected, canWrite,
}: {
  campaignId?: string;
  initial: CampaignFormValues;
  status?: string;
  sentAt?: string | null;
  recipientCount?: number;
  audienceCount: number;
  products: Array<{ id: string; title: string; price: number; imageUrl: string | null }>;
  currency: string;
  providerConnected: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [dirty, setDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [confirmSend, setConfirmSend] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const sent = status === "SENT";
  const readOnly = !canWrite || sent;

  function set<K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateBlock(index: number, block: EmailBlock) {
    set("blocks", values.blocks.map((entry, i) => (i === index ? block : entry)));
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name: values.name,
        subject: values.subject,
        previewText: values.previewText || null,
        fromName: values.fromName || null,
        fromEmail: values.fromEmail || null,
        audience: values.audience,
        blocks: values.blocks,
      };
      const result = campaignId
        ? await updateCampaignAction(campaignId, payload)
        : await createCampaignAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setDirty(false);
      if (!campaignId) router.push(`/admin/emails/${result.data.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/emails" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Emails
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {campaignId ? values.name || "Untitled campaign" : "New campaign"}
            {status && <Badge tone={sent ? "success" : "neutral"}>{status.toLowerCase()}</Badge>}
          </span>
        }
        description={
          sent
            ? `Sent to ${recipientCount ?? 0} recipients${sentAt ? ` on ${new Date(sentAt).toLocaleDateString()}` : ""}`
            : `Would reach ${audienceCount} recipient${audienceCount === 1 ? "" : "s"}`
        }
        actions={
          <>
            {campaignId && canWrite && !sent && (
              <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </Button>
            )}
            {canWrite && !sent && (
              <Button size="sm" variant="secondary" onClick={save} loading={pending} disabled={!dirty && Boolean(campaignId)}>
                {campaignId ? "Save" : "Create campaign"}
              </Button>
            )}
            {campaignId && canWrite && !sent && (
              <Button
                size="sm"
                variant="primary"
                disabled={!providerConnected || audienceCount === 0}
                onClick={() => setConfirmSend(true)}
                title={providerConnected ? undefined : "Connect an email provider to send"}
              >
                <Send />
                Send
              </Button>
            )}
          </>
        }
      />

      {!providerConnected && !sent && (
        <div className="mb-4 rounded-lg border border-ink-200 bg-white px-4 py-3 text-[13px] text-ink-600">
          <span className="font-medium text-ink-900">Sending is disabled.</span> Connect Resend under{" "}
          <Link href="/admin/integrations/resend" className="text-pine-700 underline">Integrations</Link>{" "}
          to send this campaign. You can keep editing it in the meantime.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Content</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {values.blocks.map((block, index) => (
                <div
                  key={index}
                  draggable={!readOnly}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === index) return;
                    const next = [...values.blocks];
                    const [moved] = next.splice(dragIndex, 1);
                    next.splice(index, 0, moved);
                    set("blocks", next);
                    setDragIndex(null);
                  }}
                  className="rounded-md border border-ink-200 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    {!readOnly && <GripVertical className="size-3.5 cursor-grab text-ink-300" />}
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      {block.type}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => set("blocks", values.blocks.filter((_, i) => i !== index))}
                        className="ml-auto rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                        aria-label={`Remove ${block.type} block`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>

                  <BlockEditor
                    block={block}
                    products={products}
                    currency={currency}
                    disabled={readOnly}
                    onChange={(next) => updateBlock(index, next)}
                  />
                </div>
              ))}

              {!readOnly && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {BLOCK_TYPES.map((entry) => (
                    <button
                      key={entry.type}
                      type="button"
                      onClick={() => set("blocks", [...values.blocks, blankBlock(entry.type)])}
                      className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12.5px] text-ink-600 hover:bg-ink-50"
                    >
                      <entry.icon className="size-3.5 text-ink-400" />
                      {entry.label}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-5">
                <div className="mx-auto max-w-[520px] rounded-lg border border-ink-200 bg-white p-6">
                  <p className="mb-4 text-[14px] font-semibold text-ink-900">{values.fromName || "Your store"}</p>
                  {values.blocks.map((block, index) => (
                    <BlockPreview key={index} block={block} products={products} currency={currency} />
                  ))}
                  <p className="mt-6 border-t border-ink-200 pt-3 text-[11px] text-ink-400">
                    You are receiving this because you subscribed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Campaign name" required htmlFor="name" hint="Internal only">
                <Input id="name" value={values.name} disabled={readOnly} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Subject line" required htmlFor="subject">
                <Input id="subject" value={values.subject} disabled={readOnly} onChange={(e) => set("subject", e.target.value)} />
              </Field>
              <Field label="Preview text" htmlFor="previewText" hint="Shown after the subject in most inboxes">
                <Input id="previewText" value={values.previewText} disabled={readOnly} onChange={(e) => set("previewText", e.target.value)} />
              </Field>
              <Field label="From name" htmlFor="fromName">
                <Input id="fromName" value={values.fromName} disabled={readOnly} onChange={(e) => set("fromName", e.target.value)} />
              </Field>
              <Field label="From email" htmlFor="fromEmail">
                <Input id="fromEmail" type="email" value={values.fromEmail} disabled={readOnly} onChange={(e) => set("fromEmail", e.target.value)} />
              </Field>
              <Field label="Audience" htmlFor="audience" hint={`${audienceCount} recipients`}>
                <Select id="audience" value={values.audience} disabled={readOnly} onChange={(e) => set("audience", e.target.value)}>
                  <option value="subscribers">Newsletter subscribers</option>
                  <option value="customers">Customers who opted in</option>
                  <option value="all">Everyone</option>
                </Select>
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={`Send "${values.subject}" to ${audienceCount} recipients?`}
        description="This sends real email through your connected provider. It cannot be recalled."
        confirmLabel={`Send to ${audienceCount}`}
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!campaignId) return;
            if (dirty) await updateCampaignAction(campaignId, { blocks: values.blocks, subject: values.subject });
            const result = await sendCampaignAction(campaignId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.message ?? "Sent");
            setConfirmSend(false);
            router.refresh();
          })
        }
      >
        <ul className="space-y-1 text-[13px] text-ink-600">
          <li>· Subject: {values.subject}</li>
          <li>· From: {values.fromName} &lt;{values.fromEmail}&gt;</li>
          <li>· Audience: {values.audience}</li>
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${values.name}"?`}
        description="This campaign and its content are removed."
        confirmLabel="Delete campaign"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!campaignId) return;
            const result = await deleteCampaignAction(campaignId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Campaign deleted");
            router.push("/admin/emails");
          })
        }
      />
    </div>
  );
}

function BlockEditor({
  block, products, currency, disabled, onChange,
}: {
  block: EmailBlock;
  products: Array<{ id: string; title: string; price: number; imageUrl: string | null }>;
  currency: string;
  disabled: boolean;
  onChange: (block: EmailBlock) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <Input value={block.text} disabled={disabled} aria-label="Heading text"
          onChange={(event) => onChange({ ...block, text: event.target.value })} />
      );
    case "text":
      return (
        <Textarea rows={3} value={block.text} disabled={disabled} aria-label="Paragraph text"
          placeholder="Write your message…"
          onChange={(event) => onChange({ ...block, text: event.target.value })} />
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImageField value={block.imageUrl || null} onChange={(url) => onChange({ ...block, imageUrl: url ?? "" })} />
          <Input value={block.alt ?? ""} disabled={disabled} placeholder="Alt text" aria-label="Image alt text"
            className="h-8 text-[12.5px]"
            onChange={(event) => onChange({ ...block, alt: event.target.value })} />
        </div>
      );
    case "product":
      return (
        <Select
          value={block.productId ?? ""}
          disabled={disabled}
          aria-label="Product"
          onChange={(event) => onChange({ ...block, productId: event.target.value || undefined })}
        >
          <option value="">Choose a product…</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title} — {formatMoney(product.price, currency)}
            </option>
          ))}
        </Select>
      );
    case "button":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input value={block.label} disabled={disabled} placeholder="Label" aria-label="Button label"
            onChange={(event) => onChange({ ...block, label: event.target.value })} />
          <Input value={block.href} disabled={disabled} placeholder="/shop" aria-label="Button link"
            onChange={(event) => onChange({ ...block, href: event.target.value })} />
        </div>
      );
    case "spacer":
      return (
        <Select value={block.size ?? "medium"} disabled={disabled} aria-label="Spacer size"
          onChange={(event) => onChange({ ...block, size: event.target.value as "small" | "medium" | "large" })}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </Select>
      );
    default:
      return <p className="text-[12.5px] text-ink-400">A horizontal rule.</p>;
  }
}

function BlockPreview({
  block, products, currency,
}: {
  block: EmailBlock;
  products: Array<{ id: string; title: string; price: number; imageUrl: string | null }>;
  currency: string;
}) {
  switch (block.type) {
    case "heading":
      return <h2 className="mb-2 mt-5 text-[19px] font-semibold text-ink-900">{block.text}</h2>;
    case "text":
      return <p className="mb-3 whitespace-pre-line text-[14px] leading-relaxed text-ink-700">{block.text}</p>;
    case "image":
      return block.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={block.imageUrl} alt={block.alt ?? ""} className="my-3 w-full rounded-md" />
      ) : (
        <div className="my-3 flex h-28 items-center justify-center rounded-md border border-dashed border-ink-300 text-[12px] text-ink-400">
          No image selected
        </div>
      );
    case "product": {
      const product = products.find((entry) => entry.id === block.productId);
      if (!product) {
        return (
          <div className="my-3 rounded-md border border-dashed border-ink-300 px-3 py-4 text-center text-[12px] text-ink-400">
            No product selected
          </div>
        );
      }
      return (
        <div className="my-3 flex items-center gap-3 rounded-md border border-ink-200 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl ?? "/placeholder.svg"} alt="" className="size-16 rounded object-cover" />
          <div>
            <p className="text-[14px] font-medium text-ink-900">{product.title}</p>
            <p className="tabular text-[13px] text-ink-600">{formatMoney(product.price, currency)}</p>
          </div>
        </div>
      );
    }
    case "button":
      return (
        <p className="my-4">
          <span className="inline-block rounded-md bg-ink-900 px-5 py-2.5 text-[14px] font-medium text-white">
            {block.label}
          </span>
        </p>
      );
    case "divider":
      return <hr className="my-5 border-ink-200" />;
    case "spacer":
      return <div className={cn(block.size === "large" ? "h-11" : block.size === "small" ? "h-3" : "h-6")} />;
    default:
      return null;
  }
}
