"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { ImageField } from "@/components/admin/media-picker";
import { INDUSTRIES } from "@/lib/validation/onboarding";
import {
  updateBrandSettingsAction, updateGeneralSettingsAction, updateStoreSettingsAction,
} from "@/app/actions/settings";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "SEK", "DKK", "JPY"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Stockholm",
  "Australia/Sydney", "Asia/Tokyo", "UTC",
];

function useSaver<T>(action: (values: T) => Promise<{ ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }>) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function save(values: T) {
    setErrors({});
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(result.message ?? "Saved");
      router.refresh();
    });
  }
  return { save, pending, errors };
}

export type GeneralValues = {
  name: string; description: string; contactEmail: string; supportPhone: string;
  currency: string; timezone: string; industry: string; targetCustomer: string;
  brandPersonality: string;
};

export function GeneralSettingsForm({ initial, canWrite }: { initial: GeneralValues; canWrite: boolean }) {
  const [values, setValues] = React.useState(initial);
  const { save, pending, errors } = useSaver(updateGeneralSettingsAction);

  function set<K extends keyof GeneralValues>(key: K, value: GeneralValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Store details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Store name" required error={errors.name} htmlFor="name">
            <Input id="name" value={values.name} disabled={!canWrite} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="description" hint="Shown in the storefront footer and used by the assistant.">
            <Textarea id="description" rows={3} value={values.description} disabled={!canWrite}
              onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact email" error={errors.contactEmail} htmlFor="contactEmail">
              <Input id="contactEmail" type="email" value={values.contactEmail} disabled={!canWrite}
                onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
            <Field label="Support phone" htmlFor="supportPhone">
              <Input id="supportPhone" value={values.supportPhone} disabled={!canWrite}
                onChange={(e) => set("supportPhone", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Currency" htmlFor="currency" hint="Applies to new orders; existing orders keep their currency.">
              <Select id="currency" value={values.currency} disabled={!canWrite} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
              </Select>
            </Field>
            <Field label="Timezone" htmlFor="timezone">
              <Select id="timezone" value={values.timezone} disabled={!canWrite} onChange={(e) => set("timezone", e.target.value)}>
                {TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Business profile</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              The assistant reads this when writing copy, campaigns and product descriptions.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Industry" htmlFor="industry">
            <Select id="industry" value={values.industry} disabled={!canWrite} onChange={(e) => set("industry", e.target.value)}>
              <option value="">Not set</option>
              {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
            </Select>
          </Field>
          <Field label="Target customer" htmlFor="targetCustomer">
            <Textarea id="targetCustomer" rows={2} value={values.targetCustomer} disabled={!canWrite}
              onChange={(e) => set("targetCustomer", e.target.value)} />
          </Field>
          <Field label="Brand voice" htmlFor="brandPersonality">
            <Input id="brandPersonality" value={values.brandPersonality} disabled={!canWrite}
              placeholder="Understated, practical, quietly confident"
              onChange={(e) => set("brandPersonality", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {canWrite && (
        <Button variant="primary" onClick={() => save(values)} loading={pending}>
          Save changes
        </Button>
      )}
    </div>
  );
}

export type BrandValues = {
  logoUrl: string | null; primaryColor: string; secondaryColor: string;
  fontHeading: string; fontBody: string;
};

export function BrandSettingsForm({ initial, canWrite }: { initial: BrandValues; canWrite: boolean }) {
  const [values, setValues] = React.useState(initial);
  const { save, pending, errors } = useSaver(updateBrandSettingsAction);

  function set<K extends keyof BrandValues>(key: K, value: BrandValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
        <CardContent>
          <ImageField value={values.logoUrl} onChange={(url) => set("logoUrl", url)} label="Logo" />
          <p className="mt-2 text-[11.5px] text-ink-400">
            Shown in your storefront header. Without one, your store name is used.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Colours</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Primary" error={errors.primaryColor} htmlFor="primaryColor"
            hint="Buttons and accents on your storefront.">
            <div className="flex gap-2">
              <input type="color" value={values.primaryColor} disabled={!canWrite}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border border-ink-200 bg-white p-0.5"
                aria-label="Primary colour picker" />
              <Input id="primaryColor" value={values.primaryColor} disabled={!canWrite}
                onChange={(e) => set("primaryColor", e.target.value)} />
            </div>
          </Field>
          <Field label="Secondary" error={errors.secondaryColor} htmlFor="secondaryColor"
            hint="Your wordmark and headings.">
            <div className="flex gap-2">
              <input type="color" value={values.secondaryColor} disabled={!canWrite}
                onChange={(e) => set("secondaryColor", e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border border-ink-200 bg-white p-0.5"
                aria-label="Secondary colour picker" />
              <Input id="secondaryColor" value={values.secondaryColor} disabled={!canWrite}
                onChange={(e) => set("secondaryColor", e.target.value)} />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Headings" htmlFor="fontHeading">
            <Input id="fontHeading" value={values.fontHeading} disabled={!canWrite}
              onChange={(e) => set("fontHeading", e.target.value)} />
          </Field>
          <Field label="Body" htmlFor="fontBody">
            <Input id="fontBody" value={values.fontBody} disabled={!canWrite}
              onChange={(e) => set("fontBody", e.target.value)} />
          </Field>
          <p className="text-[11.5px] text-ink-400 sm:col-span-2">
            Custom web fonts are not loaded in this build — the storefront uses a system sans stack.
            These values are stored for when font loading is added.
          </p>
        </CardContent>
      </Card>

      {canWrite && (
        <Button variant="primary" onClick={() => save(values)} loading={pending}>
          Save brand
        </Button>
      )}
    </div>
  );
}

export type PlatformValues = {
  freeShippingThreshold: string;
  taxEnabled: boolean;
  taxRate: string;
  taxIncluded: boolean;
  notifyNewOrder: boolean;
  notifyLowInventory: boolean;
  lowInventoryThreshold: string;
  notifyExperimentDone: boolean;
  aiConfirmHighImpact: boolean;
  aiTone: string;
  aiAutoApplyLowRisk: boolean;
  checkoutMode: "simulated" | "stripe";
};

export function SettingsToggleForm({
  section, initial, canWrite, stripeConnected,
}: {
  section: "payments" | "shipping" | "taxes" | "notifications" | "ai";
  initial: PlatformValues;
  canWrite: boolean;
  stripeConnected?: boolean;
}) {
  const [values, setValues] = React.useState(initial);
  const { save, pending } = useSaver(updateStoreSettingsAction);

  function set<K extends keyof PlatformValues>(key: K, value: PlatformValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function persist() {
    save({
      freeShippingThreshold: values.freeShippingThreshold ? Number(values.freeShippingThreshold) : null,
      taxEnabled: values.taxEnabled,
      taxRate: Number(values.taxRate || 0) / 100,
      taxIncluded: values.taxIncluded,
      notifyNewOrder: values.notifyNewOrder,
      notifyLowInventory: values.notifyLowInventory,
      lowInventoryThreshold: Number(values.lowInventoryThreshold || 0),
      notifyExperimentDone: values.notifyExperimentDone,
      aiConfirmHighImpact: values.aiConfirmHighImpact,
      aiTone: values.aiTone,
      aiAutoApplyLowRisk: values.aiAutoApplyLowRisk,
      checkoutMode: values.checkoutMode,
    } as never);
  }

  return (
    <div className="space-y-4">
      {section === "payments" && (
        <Card>
          <CardHeader><CardTitle>Checkout mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Mode" htmlFor="checkoutMode">
              <Select
                id="checkoutMode"
                value={values.checkoutMode}
                disabled={!canWrite}
                onChange={(e) => set("checkoutMode", e.target.value as "simulated" | "stripe")}
              >
                <option value="simulated">Simulated — orders are recorded, no payment taken</option>
                <option value="stripe" disabled={!stripeConnected}>
                  Stripe {stripeConnected ? "" : "(connect Stripe first)"}
                </option>
              </Select>
            </Field>

            <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">
              {stripeConnected ? (
                <>
                  <span className="font-medium text-ink-900">Stripe credentials are stored and valid.</span>{" "}
                  Charge creation is not implemented in this build, so selecting Stripe mode currently
                  refuses checkout rather than taking payment. Simulated mode is the working path.
                </>
              ) : (
                <>
                  <span className="font-medium text-ink-900">No payment provider is connected.</span>{" "}
                  Checkout records genuine orders without charging anyone. Connect Stripe under{" "}
                  <Link href="/admin/integrations/stripe" className="text-pine-700 underline">Integrations</Link>{" "}
                  when you are ready for live payments.
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {section === "shipping" && (
        <Card>
          <CardHeader><CardTitle>Shipping</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field
              label="Free shipping threshold"
              htmlFor="freeShippingThreshold"
              hint="Orders at or above this subtotal ship free. Leave blank to always charge."
            >
              <Input
                id="freeShippingThreshold"
                type="number" min="0" step="0.01"
                value={values.freeShippingThreshold}
                disabled={!canWrite}
                onChange={(e) => set("freeShippingThreshold", e.target.value)}
              />
            </Field>
            <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">
              Checkout charges a flat $6.95 below the threshold. Per-zone rates and carrier-calculated
              shipping are not implemented — connect a fulfillment provider when that is needed.
            </div>
          </CardContent>
        </Card>
      )}

      {section === "taxes" && (
        <Card>
          <CardHeader><CardTitle>Taxes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Charge tax at checkout"
              description="Applies one flat rate to every order."
              checked={values.taxEnabled}
              disabled={!canWrite}
              onChange={(checked) => set("taxEnabled", checked)}
            />
            {values.taxEnabled && (
              <Field label="Tax rate (%)" htmlFor="taxRate">
                <Input
                  id="taxRate" type="number" min="0" max="100" step="0.01"
                  value={values.taxRate}
                  disabled={!canWrite}
                  onChange={(e) => set("taxRate", e.target.value)}
                />
              </Field>
            )}
            <div className="rounded-md border border-[#f0dfb8] bg-[#fdf6e7] px-3 py-2.5 text-[12.5px] text-[#7a4e07]">
              <span className="font-medium">This is a single flat rate that Halyard adds at checkout — it is not a tax calculation.</span>{" "}
              It does not know where you are registered, what rate applies to a customer&apos;s address, whether a
              product is taxable, or whether a customer is exempt. Halyard does not register you for tax, does not
              file returns and does not remit tax anywhere. Automatic calculation through Stripe Tax is planned to
              arrive with Stripe checkout for storefronts; until then, confirm your obligations with an accountant
              before selling for real.
            </div>
          </CardContent>
        </Card>
      )}

      {section === "notifications" && (
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="New orders"
              description="Adds a notification when an order is placed."
              checked={values.notifyNewOrder}
              disabled={!canWrite}
              onChange={(checked) => set("notifyNewOrder", checked)}
            />
            <ToggleRow
              label="Low inventory"
              description="Warns when stock falls to the threshold below."
              checked={values.notifyLowInventory}
              disabled={!canWrite}
              onChange={(checked) => set("notifyLowInventory", checked)}
            />
            {values.notifyLowInventory && (
              <Field label="Low inventory threshold" htmlFor="lowInventoryThreshold">
                <Input
                  id="lowInventoryThreshold" type="number" min="0"
                  value={values.lowInventoryThreshold}
                  disabled={!canWrite}
                  onChange={(e) => set("lowInventoryThreshold", e.target.value)}
                />
              </Field>
            )}
            <ToggleRow
              label="Experiment completed"
              description="Tells you when an A/B test is stopped."
              checked={values.notifyExperimentDone}
              disabled={!canWrite}
              onChange={(checked) => set("notifyExperimentDone", checked)}
            />
            <p className="text-[11.5px] text-ink-400">
              Notifications appear in the bell menu. Email delivery of these alerts requires a
              connected email provider and is not implemented yet.
            </p>
          </CardContent>
        </Card>
      )}

      {section === "ai" && (
        <Card>
          <CardHeader><CardTitle>Assistant behaviour</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Always confirm high-impact actions"
              description="Pricing changes, publishing, deletions, refunds and sends stop for your approval."
              checked={values.aiConfirmHighImpact}
              disabled={!canWrite}
              onChange={(checked) => set("aiConfirmHighImpact", checked)}
            />
            <ToggleRow
              label="Run low-risk actions without asking"
              description="Creating drafts and reversible edits happen immediately, with what changed reported back."
              checked={values.aiAutoApplyLowRisk}
              disabled={!canWrite}
              onChange={(checked) => set("aiAutoApplyLowRisk", checked)}
            />
            <Field label="Writing tone" htmlFor="aiTone" hint="Used when the assistant writes customer-facing copy.">
              <Select id="aiTone" value={values.aiTone} disabled={!canWrite} onChange={(e) => set("aiTone", e.target.value)}>
                <option value="professional">Professional</option>
                <option value="warm">Warm</option>
                <option value="direct">Direct</option>
                <option value="playful">Playful</option>
              </Select>
            </Field>
            <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">
              Turning off confirmation for high-impact actions is not offered. Changes that touch your
              live store, money or deletions always ask first — that guard is enforced server-side,
              not by a setting.
            </div>
          </CardContent>
        </Card>
      )}

      {canWrite && (
        <Button variant="primary" onClick={persist} loading={pending}>
          Save changes
        </Button>
      )}
    </div>
  );
}

function ToggleRow({
  label, description, checked, disabled, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-200 pb-3 last:border-0 last:pb-0">
      <div>
        <Label className="mb-0" htmlFor={id}>{label}</Label>
        <p className="mt-0.5 text-[12px] text-ink-500">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
