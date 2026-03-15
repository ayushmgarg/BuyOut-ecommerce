import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Midnight Product Drop",
  description: "Limited edition flash sale — be fast or miss out",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-midnight-950 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
