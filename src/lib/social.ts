/**
 * Halyard's public social profiles. A profile is rendered as a link only when
 * its URL is configured; until then the mark is shown but not linked — the
 * page never points at an account that doesn't exist yet.
 *
 *   NEXT_PUBLIC_SOCIAL_INSTAGRAM=https://instagram.com/…
 *   NEXT_PUBLIC_SOCIAL_TIKTOK=…  NEXT_PUBLIC_SOCIAL_X=…
 *   NEXT_PUBLIC_SOCIAL_YOUTUBE=… NEXT_PUBLIC_SOCIAL_LINKEDIN=…
 */
export type SocialId = "instagram" | "tiktok" | "x" | "youtube" | "linkedin";

export type Social = { id: SocialId; label: string; href: string | null };

function url(value: string | undefined): string | null {
  const v = value?.trim();
  return v && /^https?:\/\//.test(v) ? v : null;
}

export function socials(): Social[] {
  return [
    { id: "instagram", label: "Instagram", href: url(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM) },
    { id: "tiktok", label: "TikTok", href: url(process.env.NEXT_PUBLIC_SOCIAL_TIKTOK) },
    { id: "x", label: "X", href: url(process.env.NEXT_PUBLIC_SOCIAL_X) },
    { id: "youtube", label: "YouTube", href: url(process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE) },
    { id: "linkedin", label: "LinkedIn", href: url(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN) },
  ];
}

/** Public contact address for the Contact link; the link is omitted when unset. */
export function contactEmail(): string | null {
  const v = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return v && v.includes("@") ? v : null;
}
