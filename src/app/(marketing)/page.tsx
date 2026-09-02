import { launchStage } from "@/lib/launch";
import { MarketingShell } from "@/components/marketing/chrome";
import { FullLanding } from "@/components/marketing/full-landing";
import { WaitlistScreen } from "@/components/marketing/waitlist-screen";

export const dynamic = "force-dynamic";

/**
 * The public entry point is decided by LAUNCH_STAGE alone. During the gated
 * stages it is the one-screen waitlist; at public launch the full landing
 * returns here without a rebuild (it stays previewable at /product meanwhile).
 */
export default function LandingPage() {
  if (launchStage() === "public") {
    return (
      <MarketingShell>
        <FullLanding />
      </MarketingShell>
    );
  }
  return <WaitlistScreen />;
}
