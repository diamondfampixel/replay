import "server-only";
import { cookies } from "next/headers";
import { STOREFRONT_SESSION_COOKIE } from "@/middleware";

/**
 * The visitor's session id, set by middleware on the first storefront request.
 * Returns an empty string only when middleware has not run (e.g. a direct API
 * call), in which case experiments simply do not apply.
 */
export async function getStorefrontSessionId(): Promise<string> {
  const jar = await cookies();
  return jar.get(STOREFRONT_SESSION_COOKIE)?.value ?? "";
}
