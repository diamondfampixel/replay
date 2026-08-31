import "dotenv/config";
import { vi } from "vitest";

// Services import `server-only`, which throws outside a React Server Component.
vi.mock("server-only", () => ({}));

// `next/headers` is unavailable outside a request scope. Tests that need a
// cookie jar install their own store via `setTestCookies`.
const jar = new Map<string, string>();

export function setTestCookie(name: string, value: string) {
  jar.set(name, value);
}
export function clearTestCookies() {
  jar.clear();
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string | { name: string; value: string }, value?: string) => {
      if (typeof name === "string") jar.set(name, value ?? "");
      else jar.set(name.name, name.value);
    },
    delete: (name: string) => jar.delete(name),
    has: (name: string) => jar.has(name),
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: <T>(fn: T) => fn,
}));
