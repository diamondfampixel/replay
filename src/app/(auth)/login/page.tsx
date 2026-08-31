import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/admin");
  return <AuthForm mode="login" action={loginAction} />;
}
