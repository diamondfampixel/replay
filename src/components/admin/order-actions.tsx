"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, MessageSquarePlus, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import {
  addOrderNoteAction, cancelOrderAction, fulfillOrderAction, refundOrderAction,
} from "@/app/actions/commerce";
import type { FulfillmentStatus, PaymentStatus } from "@/generated/prisma/client";

type Sheet = "fulfill" | "refund" | "cancel" | "note" | null;

export function OrderActions({
  orderId,
  fulfillmentStatus,
  paymentStatus,
  total,
  refunded,
  currency,
  note,
  canWrite,
}: {
  orderId: string;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  total: number;
  refunded: number;
  currency: string;
  note: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const [pending, startTransition] = React.useTransition();

  const [tracking, setTracking] = React.useState("");
  const [carrier, setCarrier] = React.useState("USPS");
  const [fulfillStatus, setFulfillStatus] = React.useState<FulfillmentStatus>("FULFILLED");
  const [refundAmount, setRefundAmount] = React.useState(String(Math.max(0, total - refunded).toFixed(2)));
  const [reason, setReason] = React.useState("");
  const [noteDraft, setNoteDraft] = React.useState(note ?? "");

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(result.message ?? "Done");
      setSheet(null);
      router.refresh();
    });
  }

  if (!canWrite) return null;

  const cancelled = fulfillmentStatus === "CANCELLED";
  const fullyRefunded = refunded >= total;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!cancelled && fulfillmentStatus !== "FULFILLED" && (
          <Button size="sm" variant="primary" onClick={() => setSheet("fulfill")}>
            <CheckCircle2 />
            Mark fulfilled
          </Button>
        )}
        {!cancelled && fulfillmentStatus === "FULFILLED" && (
          <Button size="sm" variant="secondary" onClick={() => setSheet("fulfill")}>
            <Truck />
            Update tracking
          </Button>
        )}
        {!fullyRefunded && paymentStatus !== "PENDING" && (
          <Button size="sm" variant="secondary" onClick={() => setSheet("refund")}>
            <Undo2 />
            Refund
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setSheet("note")}>
          <MessageSquarePlus />
          {note ? "Edit note" : "Add note"}
        </Button>
        {!cancelled && (
          <Button size="sm" variant="dangerOutline" onClick={() => setSheet("cancel")}>
            <Ban />
            Cancel order
          </Button>
        )}
      </div>

      <Dialog open={sheet === "fulfill"} onOpenChange={(open) => !open && setSheet(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Fulfill order</DialogTitle>
            <DialogDescription>
              Records the fulfillment against this order and adds a timeline entry. No carrier is
              contacted — connect a fulfillment provider in Integrations to buy real labels.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Fulfillment status" htmlFor="fulfillStatus">
              <Select
                id="fulfillStatus"
                value={fulfillStatus}
                onChange={(event) => setFulfillStatus(event.target.value as FulfillmentStatus)}
              >
                <option value="FULFILLED">Fulfilled — everything has shipped</option>
                <option value="PARTIALLY_FULFILLED">Partially fulfilled</option>
                <option value="UNFULFILLED">Unfulfilled</option>
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Field label="Tracking number" htmlFor="tracking">
                <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Carrier" htmlFor="carrier">
                <Select id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                  <option>USPS</option>
                  <option>UPS</option>
                  <option>FedEx</option>
                  <option>DHL</option>
                  <option>Other</option>
                </Select>
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSheet(null)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={pending}
              onClick={() =>
                run(() =>
                  fulfillOrderAction(orderId, {
                    status: fulfillStatus,
                    trackingNumber: tracking || null,
                    carrier: tracking ? carrier : null,
                  }),
                )
              }
            >
              Save fulfillment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "refund"} onOpenChange={(open) => !open && setSheet(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Refund order</DialogTitle>
            <DialogDescription>
              Up to {formatMoney(total - refunded, currency)} can be refunded. This records the refund
              against the order and updates analytics. No payment provider is charged — connect Stripe
              to issue real refunds.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Refund amount" htmlFor="refundAmount">
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0"
                max={total - refunded}
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />
            </Field>
            <Field label="Reason" htmlFor="refundReason">
              <Input id="refundReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSheet(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() => run(() => refundOrderAction(orderId, Number(refundAmount), reason || undefined))}
            >
              Refund {formatMoney(Number(refundAmount) || 0, currency)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "cancel"} onOpenChange={(open) => !open && setSheet(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {fulfillmentStatus === "UNFULFILLED"
                ? "Stock for every line is returned to inventory."
                : "Some items have already shipped, so stock is not returned automatically."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Reason" htmlFor="cancelReason">
              <Input id="cancelReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSheet(null)}>Keep order</Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() => run(() => cancelOrderAction(orderId, reason || undefined))}
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "note"} onOpenChange={(open) => !open && setSheet(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Order note</DialogTitle>
            <DialogDescription>Internal only — customers never see this.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} aria-label="Order note" />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSheet(null)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={pending}
              disabled={!noteDraft.trim()}
              onClick={() => run(() => addOrderNoteAction(orderId, noteDraft.trim()))}
            >
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
