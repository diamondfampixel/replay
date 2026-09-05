"use server";

import { revalidatePath } from "next/cache";
import { guard, ok } from "@/lib/action-result";
import { serviceContext } from "@/lib/services/context";
import { checkDomain, connectDomain, disconnectDomain } from "@/lib/services/domains";

export async function connectDomainAction(domain: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await connectDomain(ctx, domain);
    revalidatePath("/admin/settings/domain");
    return ok(result, result.status === "CONNECTED" ? "Domain connected" : "Domain saved — add the DNS records below");
  });
}

export async function checkDomainAction() {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await checkDomain(ctx);
    revalidatePath("/admin/settings/domain");
    return ok(
      result,
      result.status === "CONNECTED"
        ? "Your domain is connected"
        : result.status === "VERIFYING"
          ? "Ownership is still being verified"
          : result.status === "ERROR"
            ? "The domain needs attention"
            : "DNS is not pointing here yet",
    );
  });
}

export async function disconnectDomainAction() {
  return guard(async () => {
    const ctx = await serviceContext();
    await disconnectDomain(ctx);
    revalidatePath("/admin/settings/domain");
    return ok(null, "Domain removed");
  });
}
