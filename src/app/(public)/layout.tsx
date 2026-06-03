// src/app/(public)/layout.tsx

// You generally only need to import globals.css in the *root* layout.
// It's safe to remove this line if root already imports it.
// import '../globals.css';

import { brand } from '../ui/theme';        // one level up to /app, then /ui
import Header from '../ui/Header';          // use exact filename casing for Header.tsx
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { PublicLeafCursorFollower } from '@/components/PublicLeafCursorFollower';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: brand.bg, color: brand.text }}
    >
      <Header />
      <main data-public-cursor-root className="px-4 md:px-8 pt-8 md:pt-10 pb-20 md:pb-10">
        {children}
      </main>
      <Footer />
      <CookieBanner />
      <FeedbackWidget />
      <PublicLeafCursorFollower />
    </div>
  );
}
