import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { LanguageProvider } from "@/lib/i18n";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lineSeedSansTH = localFont({
  src: [
    { path: "../public/fonts/LINESeedSansTH_Th.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/LINESeedSansTH_Rg.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/LINESeedSansTH_Bd.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/LINESeedSansTH_XBd.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-th",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZeroEntropy — Personal Finance Tracker",
  description: "Track your income, expenses, and balance in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased dark",
        plusJakartaSans.variable,
        geistMono.variable,
        lineSeedSansTH.variable
      )}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
