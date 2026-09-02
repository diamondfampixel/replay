import "server-only";
import { reportError } from "@/lib/monitoring";

/**
 * Platform emails — verification links, password resets. Distinct from the
 * per-store marketing sender in services/email.ts: these come from Halyard
 * itself, so only the environment credentials apply, never a store's own
 * integration.
 */
export function isPlatformEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendPlatformEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!response.ok) {
      reportError("platform-email", new Error(`Resend responded ${response.status}`), {
        subject: input.subject,
      });
      return false;
    }
    return true;
  } catch (error) {
    reportError("platform-email", error, { subject: input.subject });
    return false;
  }
}

const shell = (body: string) => `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #16181c;">
    <p style="font-weight: 700; letter-spacing: .01em;">HALYARD</p>
    ${body}
    <p style="margin-top: 28px; font-size: 12px; color: #8a8e95;">
      If you didn't expect this email, you can ignore it.
    </p>
  </div>`;

export function verificationEmail(link: string) {
  return {
    subject: "Confirm your email",
    html: shell(`
      <h1 style="font-size: 19px;">Confirm your email</h1>
      <p>One click and your Halyard account is confirmed:</p>
      <p><a href="${link}" style="display: inline-block; background: #16181c; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Confirm email</a></p>
      <p style="font-size: 13px; color: #5d6167;">The link works for 24 hours.</p>`),
  };
}

export function passwordResetEmail(link: string) {
  return {
    subject: "Reset your password",
    html: shell(`
      <h1 style="font-size: 19px;">Reset your password</h1>
      <p>Someone — hopefully you — asked to reset the password for this account:</p>
      <p><a href="${link}" style="display: inline-block; background: #16181c; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Choose a new password</a></p>
      <p style="font-size: 13px; color: #5d6167;">The link works for one hour. If it wasn't you, your password is unchanged.</p>`),
  };
}
