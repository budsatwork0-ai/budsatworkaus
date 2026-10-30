export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-[24px] bg-white/70" />
      ))}
    </div>
  );
}
