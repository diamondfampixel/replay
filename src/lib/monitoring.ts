import "server-only";

/**
 * Central error reporting. Always logs a structured line; when
 * MONITORING_WEBHOOK_URL is set, also fires the event at it (fire-and-forget)
 * so a Slack channel, Discord webhook, or any JSON collector can page you.
 * The payload's `text` field keeps Slack/Discord happy out of the box.
 *
 * Deliberately dependency-free: swapping in a full APM (Sentry etc.) later is
 * a matter of replacing this function's body, not touching every call site.
 */
export function reportError(
  scope: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      scope,
      message,
      ...(extra ? { extra } : {}),
      at: new Date().toISOString(),
    }),
  );
  if (stack) console.error(stack);

  const webhook = process.env.MONITORING_WEBHOOK_URL?.trim();
  if (!webhook) return;

  void fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: `Halyard error in ${scope}: ${message}`,
      scope,
      message,
      stack: stack?.split("\n").slice(0, 8).join("\n"),
      extra,
      at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}

/**
 * Non-error signal worth a human's attention — a spend ceiling approached, an
 * unusually expensive request. Same channel as errors so one webhook covers
 * both; distinguished by level so a collector can route them differently.
 */
export function reportAlert(scope: string, message: string, extra?: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: "alert", scope, message, ...(extra ? { extra } : {}), at: new Date().toISOString() }));
  const webhook = process.env.MONITORING_WEBHOOK_URL?.trim();
  if (!webhook) return;
  void fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: `Halyard alert (${scope}): ${message}`, level: "alert", scope, message, extra }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
}
