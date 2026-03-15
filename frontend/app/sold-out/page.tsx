"use client";

import SoldOutBanner from "@/components/SoldOutBanner";

export default function SoldOutPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-5xl font-bold mb-2 tracking-tight">
        Midnight Product Drop
      </h1>
      <p className="text-midnight-100/60 mb-12 text-lg">
        Limited Edition Sneakers
      </p>

      <SoldOutBanner />

      <a
        href="/"
        className="mt-8 px-6 py-3 bg-midnight-800 hover:bg-midnight-700 rounded-lg font-semibold transition-colors"
      >
        Back to Home
      </a>
    </main>
  );
}
