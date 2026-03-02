// src/app/layout.tsx
import "./globals.css";
import { SkipLinks } from "@/components/SkipLinks";
import { LocalBusinessSchema, WebsiteSchema } from "@/components/StructuredData";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL('https://budsatwork.com'),
  title: {
    default: 'Buds at Work | Local Home & Property Services in Logan & South Brisbane',
    template: '%s | Buds at Work',
  },
  description: 'Quote-first local services in Logan & South Brisbane: home cleaning, window cleaning, yard care, dump runs, car detailing, and NDIS-friendly support.',
  keywords: ['home cleaning', 'window cleaning', 'yard care', 'dump runs', 'car detailing', 'Logan', 'South Brisbane', 'NDIS services', 'local services', 'property maintenance'],
  authors: [{ name: 'Buds at Work' }],
  creator: 'Buds at Work',
  publisher: 'Buds at Work',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: 'https://budsatwork.com',
    siteName: 'Buds at Work',
    title: 'Buds at Work | Local Home & Property Services',
    description: 'Quote-first local services: home cleaning, window cleaning, yard care, dump runs, car detailing. NDIS-friendly. Logan & South Brisbane.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Buds at Work - Your local mates for home and property services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buds at Work | Local Home & Property Services',
    description: 'Quote-first local services: cleaning, windows, yard care, dump runs, car detailing. Logan & South Brisbane.',
    images: ['/og-image.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your Google Search Console verification code here when you have it
    // google: 'your-verification-code',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <head>
        <LocalBusinessSchema />
        <WebsiteSchema />
      </head>
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <body className="min-h-screen flex flex-col bg-white text-slate-900">
        <SkipLinks />
        <main id="main-content" className="flex-1">{children}</main>
      </body>
    </html>
  );
}
