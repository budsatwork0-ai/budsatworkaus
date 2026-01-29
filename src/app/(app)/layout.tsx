// src/app/(app)/dashboard/layout.tsx
// (Server Component — no 'use client', no <html>/<body>)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background:
          'radial-gradient(160% 120% at 15% 10%, #e8f5ee 0%, #f3faf5 35%, #f9fbfd 60%, #f6f8fb 100%)',
      }}
    >
      {/* Soft backdrop blobs to match Services look */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute w-[520px] h-[520px] rounded-full blur-[60px] opacity-30"
          style={{ background: 'radial-gradient(circle, #bfe8d1 0%, transparent 60%)', top: '-120px', left: '-160px' }}
        />
        <div
          className="absolute w-[520px] h-[520px] rounded-full blur-[60px] opacity-25"
          style={{ background: 'radial-gradient(circle, #d6f4e3 0%, transparent 60%)', bottom: '-180px', right: '-140px' }}
        />
      </div>

      <section className="w-full px-4 md:px-8 lg:px-12 py-6">{children}</section>
    </div>
  );
}
