import { redirect } from "next/navigation";

/** The product story lives on the landing page now. */
export default function FeaturesPage() {
  redirect("/product#product");
}
