// src/app/(public)/layout.tsx

// You generally only need to import globals.css in the *root* layout.
// It's safe to remove this line if root already imports it.
// import '../globals.css';

import { brand } from '../ui/theme';        // one level up to /app, then /ui
import Header from '../ui/Header';          // use exact filename casing for Header.tsx
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { FeedbackWidget } from '@/components/FeedbackWidget';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: brand.bg, color: brand.text }}
    >
      <Header />
      <main className="px-4 md:px-8 py-8 md:py-10">{children}</main>
      <Footer />
      <CookieBanner />
      <FeedbackWidget />
    </div>
  );
}
