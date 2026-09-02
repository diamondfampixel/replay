"use client";

/**
 * First-party marketing analytics, client half. A random visitor id and
 * first-touch attribution live in localStorage (try/caught — private windows
 * count as fresh visitors). No cookies, no third-party script, no PII.
 */

type EventType =
  | "page_view"
  | "hero_cta"
  | "waitlist_started"
  | "waitlist_submitted"
  | "demo_viewed"
  | "pricing_viewed"
  | "faq_opened"
  | "login_click";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — analytics degrade silently */
  }
}

function visitorId(): string {
  const existing = read("hly_vid");
  if (existing) return existing;
  const id = crypto.randomUUID().replaceAll("-", "");
  write("hly_vid", id);
  return id;
}

export type Attribution = {
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
};

/** First touch wins: the campaign that brought someone stays theirs. */
export function captureAttribution(): Attribution {
  const stored = read("hly_attr");
  if (stored) {
    try {
      return JSON.parse(stored) as Attribution;
    } catch {
      /* fall through and recapture */
    }
  }

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
    source: params.get("src") ?? params.get("ref"),
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    referrer: document.referrer ? document.referrer.slice(0, 500) : null,
  };
  write("hly_attr", JSON.stringify(attribution));
  return attribution;
}

const sentOnce = new Set<string>();

export function track(type: EventType, options: { once?: boolean } = {}) {
  if (options.once) {
    if (sentOnce.has(type)) return;
    sentOnce.add(type);
  }
  const attribution = captureAttribution();
  void fetch("/api/marketing/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      type,
      path: window.location.pathname,
      visitorId: visitorId(),
      ...attribution,
    }),
  }).catch(() => undefined);
}

export function attributionForWaitlist(): Attribution {
  return captureAttribution();
}
