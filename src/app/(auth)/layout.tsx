import Link from "next/link";
import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50 flex flex-col">
      <header className="px-6 py-5">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="px-6 py-5 text-center text-[12px] text-ink-400">
        Halyard · AI commerce operating system
      </footer>
    </div>
  );
}
