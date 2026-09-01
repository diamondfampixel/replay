import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

/*
 * Draft for launch review. Accurate to how the product actually works today —
 * have a lawyer confirm jurisdiction-specific requirements before charging
 * real customers.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink-900">Privacy policy</h1>
      <p className="mt-1 text-[12.5px] text-ink-400">Last updated September 2026</p>

      <div className="prose-halyard mt-8 space-y-6 text-[14.5px] leading-relaxed text-ink-700">
        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">What Halyard is</h2>
          <p className="mt-2">
            Halyard is a platform for running an online store. There are two kinds of people in this
            policy: <strong>merchants</strong> — people with a Halyard account who run a store — and
            <strong> shoppers</strong>, the customers who visit a merchant&apos;s storefront.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">What we collect from merchants</h2>
          <p className="mt-2">
            Your name, email address and a hashed password; everything you put into your store
            (products, pages, images, settings); your conversations with the AI assistant and the
            actions it takes, kept so you have an audit trail; and usage records such as how many AI
            actions your organization has used, which we need to run plan limits and billing.
            Payments for Halyard subscriptions are processed by Stripe — we never see or store your
            card number.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">What we hold for merchants about shoppers</h2>
          <p className="mt-2">
            When a shopper buys from a Halyard storefront, the order — name, email, shipping address,
            items — is stored on the merchant&apos;s behalf. The merchant controls that data; we
            process it to run their store. Storefront analytics use a random session identifier, not
            advertising trackers, and we do not sell or share shopper data with anyone.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">The AI assistant</h2>
          <p className="mt-2">
            Assistant conversations and a compact summary of your store&apos;s state are sent to
            Anthropic, our AI provider, to generate responses. We send what the assistant needs for
            the task at hand rather than your whole database. Shopper payment details are never sent
            to the AI provider.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">Cookies</h2>
          <p className="mt-2">
            We use a session cookie to keep merchants signed in, a cart cookie so a shopper&apos;s
            cart survives page loads, and a random session id for storefront analytics and A/B
            testing. No third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">Deleting your data</h2>
          <p className="mt-2">
            You can delete your organization (Settings → Data) or your whole account (Settings →
            Your profile) from inside the product. Deletion is immediate and permanent: stores,
            orders, customers, analytics and AI history all go with it.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink-900">Contact</h2>
          <p className="mt-2">
            Questions about this policy or your data: contact the operator of this Halyard
            deployment through the address published on the site.
          </p>
        </section>
      </div>
    </main>
  );
}
