import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AIR MAX MIDNIGHT | Exclusive Drop",
  description: "Limited edition. 1,000 pairs. One chance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-display bg-midnight-950 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
