"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "halyard.session";

function readSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

const SessionContext = React.createContext<string>("");

export function useStorefrontSession() {
  return React.useContext(SessionContext);
}

export type ExperimentAssignmentLite = { experimentId: string; variantId: string };

/**
 * Records storefront events. Page views fire on navigation; product and
 * collection views are declared by the page that rendered them, together with
 * any experiment assignments so impressions are attributed correctly.
 */
export function StorefrontAnalytics({
  storeSlug,
  type = "page_view",
  productId,
  collectionId,
  experiments = [],
  children,
}: {
  storeSlug: string;
  type?: "page_view" | "product_view" | "collection_view";
  productId?: string | null;
  collectionId?: string | null;
  experiments?: ExperimentAssignmentLite[];
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = React.useState("");
  const sent = React.useRef<string>("");

  React.useEffect(() => {
    setSessionId(readSessionId());
  }, []);

  React.useEffect(() => {
    if (!sessionId) return;
    const key = `${type}:${pathname}:${productId ?? ""}:${collectionId ?? ""}`;
    if (sent.current === key) return;
    sent.current = key;

    const payload = {
      storeSlug,
      type,
      sessionId,
      productId: productId ?? null,
      collectionId: collectionId ?? null,
      path: pathname,
      referrer: document.referrer || null,
      utmSource: searchParams.get("utm_source"),
      utmMedium: searchParams.get("utm_medium"),
      utmCampaign: searchParams.get("utm_campaign"),
      experiments,
    };

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Analytics must never interfere with the shopping experience.
    });
    // `experiments` is derived from the same render as productId/collectionId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pathname, type, productId, collectionId, storeSlug]);

  return <SessionContext.Provider value={sessionId}>{children}</SessionContext.Provider>;
}
