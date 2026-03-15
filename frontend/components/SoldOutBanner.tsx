export default function SoldOutBanner() {
  return (
    <div className="mt-8 px-12 py-8 bg-red-950/40 border border-red-800/50 rounded-xl text-center">
      <p className="text-3xl font-bold text-red-400 mb-2">SOLD OUT</p>
      <p className="text-midnight-100/60">
        All units have been claimed. Better luck next time.
      </p>
    </div>
  );
}
