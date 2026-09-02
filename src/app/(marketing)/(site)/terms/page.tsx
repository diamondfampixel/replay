import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of service" };

/* Draft for launch review — lawyer pass recommended before real billing. */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-night-text">Terms of service</h1>
      <p className="mt-1 text-[12.5px] text-night-faint">Last updated September 2026</p>

      <div className="mt-8 space-y-6 text-[14.5px] leading-relaxed text-night-muted">
        <section>
          <h2 className="text-[17px] font-semibold text-night-text">The service</h2>
          <p className="mt-2">
            Halyard provides tools to build and run an online store, including an AI assistant that
            can make changes to your store at your direction. You are responsible for what you sell,
            for the content of your storefront, and for complying with the laws that apply to your
            business — including consumer, tax and product regulations.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Your account and plan</h2>
          <p className="mt-2">
            Plans and their limits are described on the pricing page. Paid plans bill monthly or
            annually through Stripe until cancelled; you can change or cancel your plan at any time
            from Settings → Plan &amp; billing, and cancellation takes effect at the end of the paid
            period. We may change prices with at least 30 days&apos; notice, applying from your next
            billing period.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">The AI assistant</h2>
          <p className="mt-2">
            The assistant acts only within your store and asks for confirmation before high-impact
            changes, but it is a tool, not a decision-maker: review what it proposes, especially
            prices and public content. AI usage is metered per your plan. You may not use the
            assistant to generate unlawful content or to misrepresent your products.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Acceptable use</h2>
          <p className="mt-2">
            No unlawful goods, no infringing content, no deceptive commerce (fake reviews, false
            claims, counterfeit), no attempts to probe or overload the platform, and no reselling of
            AI capacity. We may suspend a store that breaks these rules; where practical we will
            warn first.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Your data</h2>
          <p className="mt-2">
            Your store data is yours. We host and process it to run the service, as described in the
            privacy policy. You can export your data and can delete your organization or account at
            any time from inside the product.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-night-text">Warranty and liability</h2>
          <p className="mt-2">
            The service is provided as-is. To the extent the law allows, our liability for any claim
            is limited to the amount you paid Halyard in the twelve months before the claim arose.
          </p>
        </section>
      </div>
    </main>
  );
}
