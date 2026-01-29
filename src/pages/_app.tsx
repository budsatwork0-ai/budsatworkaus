import type { AppProps } from 'next/app';

// Minimal pages router shim so Next generates the expected pages manifests.
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
