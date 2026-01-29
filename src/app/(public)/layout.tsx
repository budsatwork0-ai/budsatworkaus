// src/app/(public)/layout.tsx

// You generally only need to import globals.css in the *root* layout.
// It's safe to remove this line if root already imports it.
// import '../globals.css';

import { brand } from '../ui/theme';        // one level up to /app, then /ui
import Header from '../ui/Header';          // use exact filename casing for Header.tsx

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const bg =
    'radial-gradient(160% 120% at 15% 10%, #e8f5ee 0%, #f3faf5 35%, #f9fbfd 60%, #f6f8fb 100%)';

  return (
    <div
      className="min-h-screen"
      style={{
        background: bg,
        color: brand.text,
      }}
    >
      {/* Soft backdrop similar to services page */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute w-[520px] h-[520px] rounded-full blur-[60px] opacity-30"
          style={{ background: 'radial-gradient(circle, #bfe8d1 0%, transparent 60%)', top: '-120px', left: '-160px' }}
        />
        <div className="absolute w-[520px] h-[520px] rounded-full blur-[60px] opacity-25"
          style={{ background: 'radial-gradient(circle, #d6f4e3 0%, transparent 60%)', bottom: '-180px', right: '-140px' }}
        />
      </div>

      <Header />
      <main className="px-4 md:px-8 py-8 md:py-10">{children}</main>
    </div>
  );
}
