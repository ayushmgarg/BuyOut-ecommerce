"use client";

export default function SuccessPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-center">
        <div className="text-6xl mb-6">&#10003;</div>
        <h1 className="text-4xl font-bold mb-4">Order Confirmed!</h1>
        <p className="text-midnight-100/60 text-lg mb-8">
          Your Midnight Edition Sneakers are secured.
        </p>
        <p className="text-sm text-midnight-100/40 mb-8">
          You&apos;ll receive a confirmation email shortly.
        </p>
        <a
          href="/"
          className="px-6 py-3 bg-midnight-800 hover:bg-midnight-700 rounded-lg font-semibold transition-colors"
        >
          Back to Home
        </a>
      </div>
    </main>
  );
}
