import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" for Next.js's own SWC pipeline;
  // Vitest (Vite 8 / rolldown-vite) transforms via oxc, not esbuild, and
  // needs its own override so it actually transforms JSX instead of just
  // parsing it.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
