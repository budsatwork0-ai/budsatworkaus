// Global vitest setup. Runs before every test file regardless of environment
// (node or jsdom — see `@vitest-environment jsdom` docblocks in *.test.tsx files).
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollIntoView; components that auto-scroll a
// message thread call it unconditionally.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// This project doesn't run vitest with `test.globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) registration (which
// depends on detecting a global `afterEach`) never fires. Register it
// explicitly so each jsdom test starts from an empty document.
if (typeof Element !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
