"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/admin/confirm";
import { slugify } from "@/lib/utils";
import { createPageAction, deletePageAction, updatePageAction } from "@/app/actions/store";

export type PageFormValues = {
  title: string;
  slug: string;
  body: string;
  published: boolean;
  showInNav: boolean;
  seoTitle: string;
  seoDescription: string;
};


export function PageForm({
  pageId, initial, storefrontUrl, canWrite,
}: {
  pageId?: string;
  initial: PageFormValues;
  storefrontUrl?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [dirty, setDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);

  function set<K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function save(overrides: Partial<PageFormValues> = {}) {
    const payload = { ...values, ...overrides };
    startTransition(async () => {
      const result = pageId
        ? await updatePageAction(pageId, payload)
        : await createPageAction(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setDirty(false);
      setConfirmPublish(false);
      if (!pageId) router.push(`/admin/content/${result.data.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/content" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Content
          </Link>
        }
        title={pageId ? values.title || "Untitled page" : "New page"}
        actions={
          <>
            {storefrontUrl && values.published && (
              <Button asChild size="sm" variant="secondary">
                <a href={storefrontUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  View
                </a>
              </Button>
            )}
            {pageId && canWrite && (
              <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </Button>
            )}
            {canWrite && (
              <>
                <Button size="sm" variant="secondary" onClick={() => save()} loading={pending} disabled={!dirty && Boolean(pageId)}>
                  Save
                </Button>
                {!values.published && (
                  <Button size="sm" variant="primary" onClick={() => setConfirmPublish(true)}>
                    Publish
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <Field label="Title" required htmlFor="title">
                <Input
                  id="title"
                  value={values.title}
                  disabled={!canWrite}
                  onChange={(event) => {
                    set("title", event.target.value);
                    if (!pageId) set("slug", slugify(event.target.value));
                  }}
                />
              </Field>

              <div>
                <Label>Content</Label>
                <Tabs defaultValue="write">
                  <TabsList>
                    <TabsTrigger value="write">Write</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="write">
                    <Textarea
                      rows={18}
                      value={values.body}
                      disabled={!canWrite}
                      onChange={(event) => set("body", event.target.value)}
                      className="font-mono text-[12.5px] leading-relaxed"
                      aria-label="Page content"
                    />
                    <p className="mt-1.5 text-[11.5px] text-ink-400">
                      Simple HTML: <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>,{" "}
                      <code>&lt;ul&gt;</code>, <code>&lt;a&gt;</code>, <code>&lt;strong&gt;</code>.
                      Scripts and event handlers are stripped when you save.
                    </p>
                  </TabsContent>
                  <TabsContent value="preview">
                    <div
                      className="prose-halyard min-h-64 rounded-md border border-ink-200 p-4"
                      dangerouslySetInnerHTML={{ __html: values.body }}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Search engine listing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Page title" htmlFor="seoTitle">
                <Input id="seoTitle" value={values.seoTitle} disabled={!canWrite}
                  placeholder={values.title}
                  onChange={(event) => set("seoTitle", event.target.value)} />
              </Field>
              <Field label="Meta description" htmlFor="seoDescription">
                <Textarea id="seoDescription" rows={2} value={values.seoDescription} disabled={!canWrite}
                  onChange={(event) => set("seoDescription", event.target.value)} />
              </Field>
              <Field label="URL slug" htmlFor="slug">
                <Input id="slug" value={values.slug} disabled={!canWrite}
                  onChange={(event) => set("slug", slugify(event.target.value))} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="mb-0" htmlFor="published">Published</Label>
                  <p className="text-[11.5px] text-ink-500">Visible to shoppers</p>
                </div>
                <Switch id="published" checked={values.published} disabled={!canWrite}
                  onCheckedChange={(checked) => set("published", checked)} />
              </div>
              <div className="flex items-center justify-between border-t border-ink-200 pt-3">
                <div>
                  <Label className="mb-0" htmlFor="showInNav">Show in navigation</Label>
                  <p className="text-[11.5px] text-ink-500">Adds a link to your menus</p>
                </div>
                <Switch id="showInNav" checked={values.showInNav} disabled={!canWrite}
                  onCheckedChange={(checked) => set("showInNav", checked)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={`Publish "${values.title}"?`}
        description="The page becomes publicly reachable on your storefront immediately."
        confirmLabel="Publish page"
        loading={pending}
        onConfirm={() => {
          set("published", true);
          save({ published: true });
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${values.title}"?`}
        description={
          values.published
            ? "This page is live. Deleting it will produce a 404 for anyone with the link."
            : "This page is not published."
        }
        confirmLabel="Delete page"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!pageId) return;
            const result = await deletePageAction(pageId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Page deleted");
            router.push("/admin/content");
          })
        }
      />
    </div>
  );
}
