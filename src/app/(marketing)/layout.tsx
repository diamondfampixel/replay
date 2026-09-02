import type { Metadata, Viewport } from "next";
import { PageViewTracker } from "@/components/marketing/page-view";

export const metadata: Metadata = {
  // absolute: the root layout's "%s · Halyard" template would otherwise
  // brand this twice ("Halyard — … · Halyard").
  title: {
    absolute: "Halyard — build your store, let AI run the rest",
    template: "%s · Halyard",
  },
  description:
    "Halyard is an AI-first ecommerce operating system: one place to build a storefront, manage products and orders, read analytics, and run growth — with an assistant that does the work.",
  openGraph: {
    title: "Halyard — build your store, let AI run the rest",
    description:
      "One operating system for products, orders, analytics, and growth — with an assistant that does the work.",
    images: ["/og.png"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

// viewport-fit=cover lets the waitlist screen pad into the phone's safe areas.
export const viewport: Viewport = { themeColor: "#07090d", viewportFit: "cover" };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-night-950 font-sans text-night-text antialiased">
      {/* Marketing display + mono faces — loaded only on the public site. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap"
      />
      <PageViewTracker />
      {children}
    </div>
  );
}
