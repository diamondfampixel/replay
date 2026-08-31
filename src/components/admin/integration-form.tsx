"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/confirm";
import { connectIntegrationAction, disconnectIntegrationAction } from "@/app/actions/integrations";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";

export function IntegrationForm({
  provider, name, fields, implementation, connected, fromEnvironment, configuredKeys, canWrite,
}: {
  provider: string;
  name: string;
  fields: IntegrationDefinition["fields"];
  implementation: IntegrationDefinition["implementation"];
  connected: boolean;
  fromEnvironment: boolean;
  configuredKeys: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  const planned = implementation === "planned";

  if (fromEnvironment) {
    return (
      <Card>
        <CardHeader><CardTitle>Credentials</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[13px] text-ink-600">
            {name} is configured through the server environment, so there is nothing to enter here.
            Remove the environment variable and reload to manage it from this screen instead.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{connected ? "Credentials" : `Connect ${name}`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field) => {
            const stored = configuredKeys.includes(field.key);
            return (
              <Field
                key={field.key}
                label={field.label}
                required={!field.optional}
                htmlFor={field.key}
                error={errors[field.key]}
                hint={
                  field.help ??
                  (stored && field.secret ? "A value is stored. Enter a new one to replace it." : undefined)
                }
              >
                <Input
                  id={field.key}
                  type={field.secret ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  placeholder={stored && field.secret ? "••••••••••••" : field.placeholder}
                  disabled={planned || !canWrite}
                  autoComplete="off"
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              </Field>
            );
          })}

          {planned ? (
            <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">
              Connecting is disabled for this provider because nothing would read the credentials.
            </p>
          ) : (
            canWrite && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  loading={pending}
                  onClick={() => {
                    setErrors({});
                    startTransition(async () => {
                      const result = await connectIntegrationAction(provider, values);
                      if (!result.ok) {
                        setErrors(result.fieldErrors ?? {});
                        toast.error(result.error);
                        return;
                      }
                      toast.success(result.message ?? "Connected");
                      setValues({});
                      router.refresh();
                    });
                  }}
                >
                  <Link2 />
                  {connected ? "Update credentials" : "Connect"}
                </Button>

                {connected && (
                  <Button variant="dangerOutline" size="sm" onClick={() => setConfirmDisconnect(true)}>
                    <Unlink />
                    Disconnect
                  </Button>
                )}
              </div>
            )
          )}

          {!planned && (
            <p className="text-[11.5px] text-ink-400">
              Credentials are validated against {name} before they are saved. If the provider rejects
              them, nothing is stored as connected.
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={`Disconnect ${name}?`}
        description={
          provider === "stripe"
            ? "Stored credentials are cleared and checkout falls back to simulated mode so your store keeps working."
            : "Stored credentials are cleared. Anything relying on this connector stops working until you reconnect."
        }
        confirmLabel="Disconnect"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await disconnectIntegrationAction(provider);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Disconnected");
            setConfirmDisconnect(false);
            router.refresh();
          })
        }
      />
    </>
  );
}
