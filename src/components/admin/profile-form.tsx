"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { changePasswordAction, updateProfileAction } from "@/app/actions/settings";

export function ProfileForm({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Name" htmlFor="profileName">
            <Input id="profileName" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email" htmlFor="profileEmail" hint="Changing your sign-in email is not supported yet.">
            <Input id="profileEmail" value={email} disabled />
          </Field>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={name === initialName || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await updateProfileAction(name);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Profile saved");
                router.refresh();
              })
            }
          >
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Current password" htmlFor="currentPassword" error={passwordError ?? undefined}>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
          <Field label="New password" htmlFor="newPassword" hint="At least 8 characters.">
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={!current || next.length < 8}
            onClick={() =>
              startTransition(async () => {
                setPasswordError(null);
                const result = await changePasswordAction(current, next);
                if (!result.ok) {
                  setPasswordError(result.error);
                  toast.error(result.error);
                  return;
                }
                toast.success("Password changed — sign in again");
                setCurrent("");
                setNext("");
                router.push("/login");
              })
            }
          >
            Change password
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
