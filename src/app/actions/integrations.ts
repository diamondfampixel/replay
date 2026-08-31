"use server";

import { revalidatePath } from "next/cache";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import { connectIntegration, disconnectIntegration } from "@/lib/services/integrations";

export async function connectIntegrationAction(provider: string, config: Record<string, string>) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await connectIntegration(ctx, provider, config);
    revalidatePath("/admin/integrations");
    revalidatePath(`/admin/integrations/${provider}`);
    revalidatePath("/admin", "layout");
    return ok(result, `Connected — ${result.label}`);
  });
}

export async function disconnectIntegrationAction(provider: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await disconnectIntegration(ctx, provider);
    revalidatePath("/admin/integrations");
    revalidatePath(`/admin/integrations/${provider}`);
    revalidatePath("/admin", "layout");
    return ok(null, "Disconnected");
  });
}
