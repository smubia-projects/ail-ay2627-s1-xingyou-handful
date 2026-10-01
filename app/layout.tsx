import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import HandPreference from "@/components/HandPreference";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "Handful",
  description: "Learn ASL, a small handful of signs a day.",
  appleWebApp: { capable: true, title: "Handful", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <HandPreference />
        {children}
      </body>
    </html>
  );
}
