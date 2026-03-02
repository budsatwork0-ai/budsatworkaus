// src/app/(app)/layout.tsx
// Passthrough layout — each sub-layout (dashboard, crew, portal) handles its own chrome and background.
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
