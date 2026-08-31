import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/misc";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Halyard — the AI commerce operating system",
    template: "%s · Halyard",
  },
  description:
    "Build, run, analyse and optimise an online business from a single place. Halyard pairs a full commerce back office with an AI operator that can actually do the work.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!rounded-md !border !border-ink-200 !bg-white !text-ink-800 !text-[13px] !shadow-lg",
              description: "!text-ink-500",
            },
          }}
        />
      </body>
    </html>
  );
}
