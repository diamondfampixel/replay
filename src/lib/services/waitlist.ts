import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const waitlistInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().trim().max(80).optional().nullable(),
  utmSource: z.string().trim().max(120).optional().nullable(),
  utmMedium: z.string().trim().max(120).optional().nullable(),
  utmCampaign: z.string().trim().max(120).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
});

export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

/**
 * Adds an address to the waitlist. Joining twice is not an error — the caller
 * gets the same calm success either way, so the form can't be used to test
 * which addresses are already on the list.
 */
export async function joinWaitlist(input: WaitlistInput): Promise<{ alreadyJoined: boolean }> {
  const existing = await prisma.waitlistEntry.findUnique({ where: { email: input.email } });
  if (existing) return { alreadyJoined: true };

  await prisma.waitlistEntry.create({
    data: {
      email: input.email,
      source: input.source ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      referrer: input.referrer ?? null,
    },
  });
  return { alreadyJoined: false };
}

export async function waitlistCount(): Promise<number> {
  return prisma.waitlistEntry.count();
}
