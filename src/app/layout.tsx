// src/app/layout.tsx
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Footer } from "@/components/Footer";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-slate-900">
        {publishableKey ? (
          <ClerkProvider publishableKey={publishableKey}>
            <main className="flex-1">{children}</main>
            <Footer />
          </ClerkProvider>
        ) : (
          <>
            <main className="flex-1">{children}</main>
            <Footer />
          </>
        )}
      </body>
    </html>
  );
}
