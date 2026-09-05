import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored hashed so a database leak cannot be replayed as a session. */
export function hashToken(token: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set; refusing to issue or verify tokens without it.");
  }
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export const SESSION_COOKIE = "halyard_session";
export const SESSION_TTL_DAYS = 30;
