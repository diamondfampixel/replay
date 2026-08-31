import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { PageForm } from "@/components/admin/page-form";
import { EMPTY_PAGE } from "@/lib/form-defaults";

export const metadata: Metadata = { title: "New page" };

export default async function NewContentPage() {
  await requireCapability("content:write");
  return <PageForm initial={EMPTY_PAGE} canWrite />;
}
