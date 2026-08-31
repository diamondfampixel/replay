"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/misc";
import { DemoTag } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { addSubscriberAction, setSubscriberStatusAction } from "@/app/actions/marketing";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string;
  isDemo: boolean;
  createdAt: string;
};

export function SubscribersTable({
  subscribers,
  canWrite,
}: {
  subscribers: Subscriber[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-3 py-2.5">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Add an email address…"
            type="email"
            className="h-8 max-w-64 text-[13px]"
            aria-label="New subscriber email"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!email.includes("@") || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await addSubscriberAction(email);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Subscriber added");
                setEmail("");
                router.refresh();
              })
            }
          >
            <Plus />
            Add
          </Button>

          {selected.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[12.5px] text-ink-600">{selected.length} selected</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setSubscriberStatusAction(selected, "subscribed");
                    setSelected([]);
                    router.refresh();
                  })
                }
              >
                Resubscribe
              </Button>
              <Button
                size="sm"
                variant="dangerOutline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setSubscriberStatusAction(selected, "unsubscribed");
                    setSelected([]);
                    router.refresh();
                  })
                }
              >
                Unsubscribe
              </Button>
            </div>
          )}
        </div>
      )}

      <TableWrap>
        <Table>
          <THead>
            <tr>
              {canWrite && (
                <TH className="w-9">
                  <Checkbox
                    checked={selected.length === subscribers.length && subscribers.length > 0}
                    onCheckedChange={(checked) => setSelected(checked ? subscribers.map((s) => s.id) : [])}
                    aria-label="Select all subscribers"
                  />
                </TH>
              )}
              <TH>Email</TH>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH>Source</TH>
              <TH>Added</TH>
            </tr>
          </THead>
          <TBody>
            {subscribers.map((subscriber) => (
              <TR key={subscriber.id}>
                {canWrite && (
                  <TD>
                    <Checkbox
                      checked={selected.includes(subscriber.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked ? [...prev, subscriber.id] : prev.filter((id) => id !== subscriber.id),
                        )
                      }
                      aria-label={`Select ${subscriber.email}`}
                    />
                  </TD>
                )}
                <TD>
                  <span className="flex items-center gap-1.5">
                    <span className="text-ink-800">{subscriber.email}</span>
                    {subscriber.isDemo && <DemoTag label="Demo" />}
                  </span>
                </TD>
                <TD className="text-ink-500">{subscriber.name ?? "—"}</TD>
                <TD>
                  <Badge tone={subscriber.status === "subscribed" ? "success" : "neutral"}>
                    {subscriber.status}
                  </Badge>
                </TD>
                <TD className="capitalize text-ink-500">{subscriber.source}</TD>
                <TD className="whitespace-nowrap text-ink-500">{formatDate(subscriber.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}
