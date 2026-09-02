import type { Metadata } from "next";

export const metadata: Metadata = { title: "Refunds & cancellation" };

export default function RefundsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-night-text">
        Refunds &amp; cancellation
      </h1>
      <p className="mt-1 text-[12.5px] text-night-faint">Last updated September 2026</p>

      <div className="mt-8 space-y-6 text-[14.5px] leading-relaxed text-night-muted">
        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Cancelling</h2>
          <p className="mt-2">
            Cancel anytime from Settings → Plan &amp; billing (Manage billing). Your plan stays
            active until the end of the period you&apos;ve paid for, then moves to the free Harbor
            plan. Your store and data stay intact — only paid capabilities switch off.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Refunds</h2>
          <p className="mt-2">
            Monthly plans: your first paid month is $1, which is our version of a trial — beyond
            that, monthly charges are not refunded, you simply cancel and are not billed again.
            Annual plans: within 14 days of an annual charge we refund it in full, no questions;
            after 14 days we refund the unused months, pro-rated, if you ask.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Your customers&apos; refunds</h2>
          <p className="mt-2">
            Refunds for things sold in your store are between you and your customer, on the policy
            you publish, through your own payment provider. Halyard&apos;s admin supports recording
            and processing them, but the money and the obligation are yours.
          </p>
        </section>
      </div>
    </main>
  );
}
