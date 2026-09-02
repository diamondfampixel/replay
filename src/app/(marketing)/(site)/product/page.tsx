import type { Metadata } from "next";
import { FullLanding } from "@/components/marketing/full-landing";
import { launchStage } from "@/lib/launch";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  // During the gated stages the focused waitlist is the public entry point;
  // the full tour stays reachable but out of search results.
  return {
    title: "Product",
    robots: launchStage() === "public" ? undefined : { index: false, follow: false },
  };
}

export default function ProductPage() {
  return <FullLanding />;
}
