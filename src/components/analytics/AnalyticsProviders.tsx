import { PostHogProvider } from './PostHogProvider';
import { ClarityInit } from './ClarityInit';
import { HotjarInit } from './HotjarInit';

export function AnalyticsProviders({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <ClarityInit />
      <HotjarInit />
      {children}
    </PostHogProvider>
  );
}
