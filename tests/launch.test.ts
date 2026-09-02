import { afterEach, describe, expect, it } from "vitest";
import { testDb } from "./helpers";
import { joinWaitlist, waitlistInputSchema } from "@/lib/services/waitlist";
import { launchStage, isValidInvite, signupIsOpen, primaryCta } from "@/lib/launch";

afterEach(() => {
  delete process.env.LAUNCH_STAGE;
  delete process.env.WAITLIST_INVITE_CODES;
});

describe("launch stage configuration", () => {
  it("defaults to public and honours the env flag", () => {
    expect(launchStage()).toBe("public");
    expect(signupIsOpen()).toBe(true);

    process.env.LAUNCH_STAGE = "waitlist";
    expect(launchStage()).toBe("waitlist");
    expect(signupIsOpen()).toBe(false);
    expect(primaryCta()).toEqual({ label: "Join the waitlist", kind: "waitlist" });

    process.env.LAUNCH_STAGE = "early-access";
    expect(primaryCta()).toEqual({ label: "Request early access", kind: "waitlist" });
  });

  it("validates invite codes from the environment", () => {
    process.env.WAITLIST_INVITE_CODES = "crew-alpha, crew-beta";
    expect(isValidInvite("crew-alpha")).toBe(true);
    expect(isValidInvite("crew-beta")).toBe(true);
    expect(isValidInvite("CREW-ALPHA")).toBe(false);
    expect(isValidInvite("")).toBe(false);
    expect(isValidInvite(undefined)).toBe(false);
  });
});

describe("gated signup", () => {
  it("refuses signup without a code during waitlist stage, accepts with one", async () => {
    process.env.LAUNCH_STAGE = "waitlist";
    process.env.WAITLIST_INVITE_CODES = "tester-1";
    const { signupAction } = await import("@/app/actions/auth");

    const email = `gate-${Date.now()}@example.test`;
    const form = new FormData();
    form.set("name", "Gate Test");
    form.set("email", email);
    form.set("password", "a-password-123");

    const refused = await signupAction(form);
    expect(refused.ok).toBe(false);

    form.set("inviteCode", "tester-1");
    const accepted = await signupAction(form);
    expect(accepted.ok).toBe(true);

    const user = await testDb.user.findUniqueOrThrow({ where: { email } });
    await testDb.session.deleteMany({ where: { userId: user.id } });
    await testDb.user.delete({ where: { id: user.id } });
  });
});

describe("the waitlist", () => {
  it("stores a signup with its acquisition context", async () => {
    const email = `wait-${Date.now()}@example.test`;
    const result = await joinWaitlist({
      email,
      source: "tiktok",
      utmSource: "tiktok",
      utmMedium: "video",
      utmCampaign: "launch-teaser",
      referrer: "https://www.tiktok.com/",
    });
    expect(result.alreadyJoined).toBe(false);

    const row = await testDb.waitlistEntry.findUniqueOrThrow({ where: { email } });
    expect(row.status).toBe("PENDING");
    expect(row.utmCampaign).toBe("launch-teaser");

    // Joining again is calm, not an error — and creates no second row.
    const again = await joinWaitlist({ email });
    expect(again.alreadyJoined).toBe(true);
    expect(await testDb.waitlistEntry.count({ where: { email } })).toBe(1);

    await testDb.waitlistEntry.delete({ where: { email } });
  });

  it("normalises and validates the email", () => {
    const parsed = waitlistInputSchema.parse({ email: "  Person@Example.COM " });
    expect(parsed.email).toBe("person@example.com");
    expect(waitlistInputSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(waitlistInputSchema.safeParse({ email: "" }).success).toBe(false);
  });
});
