import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext, clientErrorMessage } from "@/lib/services/context";
import { reportError } from "@/lib/monitoring";
import { cancelPendingAction, confirmPendingAction, undoAction } from "@/lib/ai/executor";

export const runtime = "nodejs";

const bodySchema = z.object({
  actionId: z.string(),
  decision: z.enum(["confirm", "cancel", "undo"]),
});

export async function POST(request: Request) {
  const ctx = await apiContext({ actor: "ai" });
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    if (parsed.data.decision === "cancel") {
      await cancelPendingAction(parsed.data.actionId, ctx);
      return NextResponse.json({ status: "cancelled" });
    }

    if (parsed.data.decision === "undo") {
      const result = await undoAction(parsed.data.actionId, ctx);
      return NextResponse.json({ status: "undone", summary: result.summary });
    }

    const outcome = await confirmPendingAction(parsed.data.actionId, ctx);
    if (outcome.status === "executed") {
      return NextResponse.json({
        status: "executed",
        summary: outcome.result.summary,
        links: outcome.result.links,
        actionId: outcome.actionId,
        undoable: Boolean(outcome.result.undo),
      });
    }
    return NextResponse.json(
      { status: "failed", error: outcome.status === "failed" ? outcome.error : "Could not complete." },
      { status: 400 },
    );
  } catch (error) {
    reportError("api/ai/confirm", error);
    const message = clientErrorMessage(error, "Could not complete that.");
    return NextResponse.json({ status: "failed", error: message }, { status: 400 });
  }
}
