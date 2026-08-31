import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signupAction } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/admin");
  return <AuthForm mode="signup" action={signupAction} />;
}
