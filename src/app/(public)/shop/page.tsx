import { brand } from '../../ui/theme';
export default function ShopPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(750px circle at 20% 12%, #e6f6ef 0, transparent 50%), radial-gradient(950px circle at 80% 5%, #e8f4ec 0, transparent 55%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-8 py-12">
        <section className="rounded-3xl p-8 border border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
          <h1 className="text-3xl font-bold" style={{color:brand.primary}}>Shop</h1>
          <p className="mt-3 text-slate-700">Coming soon.</p>
        </section>
      </div>
    </main>
  );
}
