"use client";

import * as React from "react";
import { toast } from "sonner";
import { deleteAccountAction, deleteOrganizationAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DeleteOrganizationCard({ organizationName, isOwner }: { organizationName: string; isOwner: boolean }) {
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!isOwner) return null;

  return (
    <Card className="border-[var(--color-signal-negative)]/40">
      <CardHeader>
        <CardTitle>Delete this organization</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[13px] text-ink-600">
          Permanently deletes <span className="font-medium text-ink-900">{organizationName}</span> —
          its stores, catalog, orders, customers, analytics and AI history. This cannot be undone,
          and there is no grace period. Type the organization name to confirm.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={organizationName}
            className="h-9 max-w-72"
          />
          <Button
            variant="danger"
            size="sm"
            disabled={confirm.trim() !== organizationName}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await deleteOrganizationAction(confirm);
              setBusy(false);
              if (result && !result.ok) toast.error(result.error);
            }}
          >
            Delete organization
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DeleteAccountCard() {
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <Card className="border-[var(--color-signal-negative)]/40">
      <CardHeader>
        <CardTitle>Delete your account</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[13px] text-ink-600">
          Deletes your sign-in and any organization where you are the only member. If other people
          work in an organization you own, transfer ownership first. Enter your password to confirm.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            className="h-9 max-w-72"
            autoComplete="current-password"
          />
          <Button
            variant="danger"
            size="sm"
            disabled={password.length === 0}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await deleteAccountAction(password);
              setBusy(false);
              if (result && !result.ok) toast.error(result.error);
            }}
          >
            Delete account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
