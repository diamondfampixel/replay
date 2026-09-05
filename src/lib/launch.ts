/**
 * The launch stage decides what the public conversion path is. It is pure
 * configuration — no routes are deleted, authentication is untouched, and
 * moving from waitlist to public launch is an environment change:
 *
 *   LAUNCH_STAGE=waitlist      visitors join the waitlist; signup needs an invite
 *                              (also the default when the variable is unset —
 *                              a deployment that forgot to set it must never
 *                              open signup to the public by accident)
 *   LAUNCH_STAGE=early-access  same gate, "request access" framing
 *   LAUNCH_STAGE=public        open signup; must be set explicitly
 *
 * Existing accounts sign in normally at every stage — testers and admins are
 * simply people with accounts (created with an invite code, or seeded).
 */
export type LaunchStage = "waitlist" | "early-access" | "public";

export function launchStage(): LaunchStage {
  const raw = process.env.LAUNCH_STAGE?.trim().toLowerCase();
  if (raw === "public") return "public";
  if (raw === "early-access") return "early-access";
  return "waitlist";
}

export function signupIsOpen(): boolean {
  return launchStage() === "public";
}

/** Invite codes that open signup during the gated stages. Comma-separated. */
export function inviteCodes(): string[] {
  return (process.env.WAITLIST_INVITE_CODES ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

export function isValidInvite(code: string | null | undefined): boolean {
  if (!code) return false;
  return inviteCodes().includes(code.trim());
}

/** The primary call to action, per stage — the site never rebuilds, the CTA changes. */
export function primaryCta(): { label: string; kind: "waitlist" | "signup" } {
  const stage = launchStage();
  if (stage === "waitlist") return { label: "Join the waitlist", kind: "waitlist" };
  if (stage === "early-access") return { label: "Request early access", kind: "waitlist" };
  return { label: "Start free", kind: "signup" };
}
