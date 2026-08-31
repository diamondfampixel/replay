"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/misc";
import { DemoTag } from "@/components/ui/states";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/confirm";
import { Stars } from "@/components/storefront/primitives";
import { REVIEW_TONE } from "@/lib/status";
import { formatDate } from "@/lib/format";
import {
  createReviewAction, deleteReviewsAction, setReviewStatusAction,
} from "@/app/actions/marketing";
import type { ReviewStatus } from "@/generated/prisma/client";

type Review = {
  id: string;
  productId: string;
  productTitle: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  verified: boolean;
  isDemo: boolean;
  createdAt: string;
};

export function ReviewsTable({
  reviews, products, canWrite,
}: {
  reviews: Review[];
  products: Array<{ id: string; title: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState<string[] | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      if (result.message) toast.success(result.message);
      setSelected([]);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-3 py-2">
          <Checkbox
            checked={selected.length === reviews.length && reviews.length > 0}
            onCheckedChange={(checked) => setSelected(checked ? reviews.map((r) => r.id) : [])}
            aria-label="Select all reviews"
          />
          <span className="text-[12.5px] text-ink-600">
            {selected.length > 0 ? `${selected.length} selected` : "Select all"}
          </span>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" disabled={pending}
                onClick={() => run(() => setReviewStatusAction(selected, "PUBLISHED"))}>
                <Check />
                Publish
              </Button>
              <Button size="sm" variant="secondary" disabled={pending}
                onClick={() => run(() => setReviewStatusAction(selected, "HIDDEN"))}>
                <EyeOff />
                Hide
              </Button>
              <Button size="sm" variant="dangerOutline" disabled={pending}
                onClick={() => setConfirmDelete(selected)}>
                <Trash2 />
                Delete
              </Button>
            </div>
          )}

          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAddOpen(true)}>
            <Plus />
            Add a review
          </Button>
        </div>
      )}

      <ul className="divide-y divide-ink-200">
        {reviews.map((review) => (
          <li key={review.id} className="flex gap-3 px-4 py-3.5">
            {canWrite && (
              <Checkbox
                className="mt-1"
                checked={selected.includes(review.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) =>
                    checked ? [...prev, review.id] : prev.filter((id) => id !== review.id),
                  )
                }
                aria-label={`Select review by ${review.authorName}`}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={review.rating} />
                {review.title && <span className="text-[13.5px] font-semibold text-ink-900">{review.title}</span>}
                <Badge tone={REVIEW_TONE[review.status]}>{review.status.toLowerCase()}</Badge>
                {review.verified && <Badge tone="outline">verified</Badge>}
                {review.isDemo && <DemoTag label="Demo" />}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{review.body}</p>
              <p className="mt-1.5 text-[11.5px] text-ink-400">
                {review.authorName} on{" "}
                <Link href={`/admin/products/${review.productId}`} className="text-pine-700 hover:underline">
                  {review.productTitle}
                </Link>{" "}
                · {formatDate(review.createdAt)}
              </p>
            </div>
            {canWrite && (
              <div className="flex shrink-0 flex-col gap-1">
                {review.status !== "PUBLISHED" && (
                  <Button size="sm" variant="secondary" disabled={pending}
                    onClick={() => run(() => setReviewStatusAction([review.id], "PUBLISHED"))}>
                    Publish
                  </Button>
                )}
                {review.status === "PUBLISHED" && (
                  <Button size="sm" variant="secondary" disabled={pending}
                    onClick={() => run(() => setReviewStatusAction([review.id], "HIDDEN"))}>
                    Hide
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <AddReviewDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        products={products}
        onSaved={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.length ?? 0} review${confirmDelete?.length === 1 ? "" : "s"}?`}
        description="This cannot be undone. Product ratings will be recalculated."
        confirmLabel="Delete"
        destructive
        loading={pending}
        onConfirm={() => confirmDelete && run(() => deleteReviewsAction(confirmDelete))}
      />
    </>
  );
}

function AddReviewDialog({
  open, onOpenChange, products, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; title: string }>;
  onSaved: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [values, setValues] = React.useState({
    productId: "", authorName: "", rating: 5, title: "", body: "", verified: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a review</DialogTitle>
          <DialogDescription>
            For reviews a customer actually gave you — over email, on a card, in person. It is held
            for moderation so you can check it before it appears on your store.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="Product" required htmlFor="reviewProduct">
            <Select
              id="reviewProduct"
              value={values.productId}
              onChange={(event) => setValues((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">Choose a product…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name" required htmlFor="reviewAuthor">
              <Input
                id="reviewAuthor"
                value={values.authorName}
                onChange={(event) => setValues((prev) => ({ ...prev, authorName: event.target.value }))}
              />
            </Field>
            <Field label="Rating" htmlFor="reviewRating">
              <Select
                id="reviewRating"
                value={String(values.rating)}
                onChange={(event) => setValues((prev) => ({ ...prev, rating: Number(event.target.value) }))}
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Title" htmlFor="reviewTitle">
            <Input
              id="reviewTitle"
              value={values.title}
              onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
            />
          </Field>
          <Field label="Review" required htmlFor="reviewBody">
            <Textarea
              id="reviewBody"
              rows={4}
              value={values.body}
              onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--color-pine-600)]"
              checked={values.verified}
              onChange={(event) => setValues((prev) => ({ ...prev, verified: event.target.checked }))}
            />
            This customer bought the product
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={!values.productId || !values.authorName.trim() || !values.body.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await createReviewAction(values);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Review added, awaiting moderation");
                setValues({ productId: "", authorName: "", rating: 5, title: "", body: "", verified: false });
                onSaved();
              })
            }
          >
            Add review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
