export default function SoldOutBanner() {
  return (
    <div className="text-center">
      <p className="text-5xl font-black text-snkrs-crimson uppercase tracking-tight mb-3">
        Sold Out
      </p>
      <p className="text-white/40 text-sm tracking-wide">
        All 1,000 pairs have been claimed
      </p>
      <div className="mt-4 mx-auto w-32 h-px bg-gradient-to-r from-transparent via-snkrs-crimson/50 to-transparent" />
    </div>
  );
}
