import { brand, glass } from '../../../ui/theme';

interface AuthCardProps {
  children: React.ReactNode;
}

// The shared glass card shell used by every auth page.
export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className={`${glass} rounded-2xl overflow-hidden`}>
      <div style={{ height: 3, background: brand.primary }} />
      <div className="px-8 pt-8 pb-10">
        {children}
      </div>
    </div>
  );
}
