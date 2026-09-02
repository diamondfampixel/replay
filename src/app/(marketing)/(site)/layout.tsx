import { MarketingShell } from "@/components/marketing/chrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
