import Link from "next/link";

export default function StorefrontNotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-28 text-center">
      <p className="tabular text-[46px] font-semibold leading-none tracking-[-0.03em] text-ink-200">404</p>
      <h1 className="mt-3 text-[20px] font-semibold text-ink-900">We couldn&apos;t find that</h1>
      <p className="mt-1.5 text-[14.5px] text-ink-500">
        The product or page may have been removed, or the link may be wrong.
      </p>
      <Link
        href="../shop"
        className="mt-6 inline-flex h-11 items-center rounded-md bg-ink-900 px-6 text-[14px] font-medium text-white hover:bg-ink-800"
      >
        Browse the shop
      </Link>
    </div>
  );
}
