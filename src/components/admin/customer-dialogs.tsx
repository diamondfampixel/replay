"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/misc";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createCustomerAction, updateCustomerAction } from "@/app/actions/commerce";

export type CustomerFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  notes: string;
  tags: string[];
  acceptsMarketing: boolean;
};

const EMPTY: CustomerFormValues = {
  email: "", firstName: "", lastName: "", phone: "", notes: "", tags: [], acceptsMarketing: false,
};

export function NewCustomerButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        <Plus />
        Add customer
      </Button>
      <CustomerDialog open={open} onOpenChange={setOpen} initial={EMPTY} />
    </>
  );
}

export function EditCustomerButton({
  customerId,
  initial,
}: {
  customerId: string;
  initial: CustomerFormValues;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Edit customer
      </Button>
      <CustomerDialog open={open} onOpenChange={setOpen} initial={initial} customerId={customerId} />
    </>
  );
}

function CustomerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CustomerFormValues;
  customerId?: string;
}) {
  // Remounting on open is the simplest way to reset the form to `initial`.
  return props.open ? <CustomerDialogForm key={String(props.open)} {...props} /> : null;
}

function CustomerDialogForm({
  open, onOpenChange, initial, customerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CustomerFormValues;
  customerId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [tagDraft, setTagDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || null,
        notes: values.notes || null,
        tags: values.tags,
        acceptsMarketing: values.acceptsMarketing,
      };
      const result = customerId
        ? await updateCustomerAction(customerId, payload)
        : await createCustomerAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customerId ? "Edit customer" : "New customer"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" required error={errors.firstName} htmlFor="firstName">
              <Input id="firstName" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Last name" error={errors.lastName} htmlFor="lastName">
              <Input id="lastName" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
          </div>
          <Field label="Email" required error={errors.email} htmlFor="customerEmail">
            <Input
              id="customerEmail"
              type="email"
              value={values.email}
              disabled={Boolean(customerId)}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <div>
            <Label htmlFor="customerTags">Tags</Label>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {values.tags.map((tag) => (
                <Badge key={tag} tone="neutral" className="pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => set("tags", values.tags.filter((t) => t !== tag))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-ink-200"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              id="customerTags"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== ",") return;
                event.preventDefault();
                const tag = tagDraft.trim().toLowerCase();
                if (tag && !values.tags.includes(tag)) set("tags", [...values.tags, tag]);
                setTagDraft("");
              }}
              placeholder="Type and press Enter"
              className="h-8 text-[13px]"
            />
          </div>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-ink-200 px-3 py-2">
            <Label className="mb-0" htmlFor="acceptsMarketing">Accepts marketing email</Label>
            <Switch
              id="acceptsMarketing"
              checked={values.acceptsMarketing}
              onCheckedChange={(checked) => set("acceptsMarketing", checked)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} loading={pending}>
            {customerId ? "Save changes" : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
