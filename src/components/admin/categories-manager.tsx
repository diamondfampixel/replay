"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/confirm";
import { cn, slugify } from "@/lib/utils";
import type { CategoryNode } from "@/lib/services/categories";
import {
  createCategoryAction, deleteCategoryAction, updateCategoryAction,
} from "@/app/actions/catalog";

type FlatCategory = { id: string; name: string; depth: number };

function flatten(nodes: CategoryNode[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

export function CategoriesManager({
  tree,
  canWrite,
}: {
  tree: CategoryNode[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState<{ node?: CategoryNode; parentId?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<CategoryNode | null>(null);

  const flat = React.useMemo(() => flatten(tree), [tree]);

  function refresh() {
    router.refresh();
  }

  if (!tree.length) {
    return (
      <>
        <Card>
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Categories classify what a product is — Clothing → Hoodies. Collections are for merchandising; these two are deliberately separate."
            action={canWrite ? { label: "Create category", onClick: () => setEditing({}) } : undefined}
          />
        </Card>
        <CategoryDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          node={editing?.node}
          parentId={editing?.parentId}
          categories={flat}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="primary" onClick={() => setEditing({})}>
            <Plus />
            Create category
          </Button>
        </div>
      )}
      <Card>
        <ul className="divide-y divide-ink-200">
          {tree.map((node) => (
            <CategoryRow
              key={node.id}
              node={node}
              depth={0}
              canWrite={canWrite}
              onEdit={(target) => setEditing({ node: target })}
              onAddChild={(parentId) => setEditing({ parentId })}
              onDelete={setConfirmDelete}
            />
          ))}
        </ul>
      </Card>

      <CategoryDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        node={editing?.node}
        parentId={editing?.parentId}
        categories={flat}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name}?`}
        description={
          confirmDelete?.productCount
            ? `${confirmDelete.productCount} product${confirmDelete.productCount === 1 ? "" : "s"} will become uncategorised. The products themselves are not deleted.`
            : "This category has no products."
        }
        confirmLabel="Delete category"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!confirmDelete) return;
            const result = await deleteCategoryAction(confirmDelete.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.message ?? "Category deleted");
            setConfirmDelete(null);
            refresh();
          })
        }
      />
    </>
  );
}

function CategoryRow({
  node, depth, canWrite, onEdit, onAddChild, onDelete,
}: {
  node: CategoryNode;
  depth: number;
  canWrite: boolean;
  onEdit: (node: CategoryNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (node: CategoryNode) => void;
}) {
  return (
    <>
      <li className="flex items-center gap-2 px-3 py-2.5 hover:bg-ink-50">
        <div style={{ paddingLeft: depth * 20 }} className="flex min-w-0 flex-1 items-center gap-2">
          {depth > 0 && <ChevronRight className="size-3 shrink-0 text-ink-300" />}
          <div className="min-w-0">
            <p className={cn("truncate text-[13px]", depth === 0 ? "font-medium text-ink-900" : "text-ink-700")}>
              {node.name}
            </p>
            <p className="truncate text-[11.5px] text-ink-400">/{node.slug}</p>
          </div>
        </div>

        <Link
          href={`/admin/products?categoryId=${node.id}`}
          className="tabular shrink-0 rounded border border-ink-200 px-2 py-0.5 text-[11.5px] text-ink-600 hover:bg-white"
        >
          {node.productCount} product{node.productCount === 1 ? "" : "s"}
        </Link>

        {canWrite && (
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label={`Add sub-category to ${node.name}`}
              title="Add sub-category"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label={`Edit ${node.name}`}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
              aria-label={`Delete ${node.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </li>
      {node.children.map((child) => (
        <CategoryRow
          key={child.id}
          node={child}
          depth={depth + 1}
          canWrite={canWrite}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node?: CategoryNode;
  parentId?: string;
  categories: FlatCategory[];
  onSaved: () => void;
};

function CategoryDialog(props: CategoryDialogProps) {
  // Remounting per target resets the form without an effect.
  return props.open ? (
    <CategoryDialogForm key={props.node?.id ?? props.parentId ?? "new"} {...props} />
  ) : null;
}

function CategoryDialogForm({
  open, onOpenChange, node, parentId, categories, onSaved,
}: CategoryDialogProps) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [values, setValues] = React.useState({
    name: node?.name ?? "",
    slug: node?.slug ?? "",
    description: node?.description ?? "",
    parentId: node?.parentId ?? parentId ?? "",
  });

  function save() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        name: values.name,
        slug: values.slug || slugify(values.name),
        description: values.description || null,
        parentId: values.parentId || null,
      };
      const result = node
        ? await updateCategoryAction(node.id, payload)
        : await createCategoryAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{node ? `Edit ${node.name}` : "New category"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="Name" required error={errors.name} htmlFor="categoryName">
            <Input
              id="categoryName"
              autoFocus
              value={values.name}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  name: event.target.value,
                  slug: node ? prev.slug : slugify(event.target.value),
                }))
              }
              placeholder="Hoodies"
            />
          </Field>
          <Field label="Parent category" htmlFor="categoryParent">
            <Select
              id="categoryParent"
              value={values.parentId}
              onChange={(event) => setValues((prev) => ({ ...prev, parentId: event.target.value }))}
            >
              <option value="">Top level</option>
              {categories
                .filter((category) => category.id !== node?.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {"— ".repeat(category.depth)}{category.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="categoryDescription">
            <Textarea
              id="categoryDescription"
              rows={2}
              value={values.description}
              onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            />
          </Field>
          <Field label="Slug" error={errors.slug} htmlFor="categorySlug">
            <Input
              id="categorySlug"
              value={values.slug}
              onChange={(event) => setValues((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} loading={pending} disabled={!values.name.trim()}>
            {node ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
