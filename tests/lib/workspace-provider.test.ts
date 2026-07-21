// No JSX here deliberately: vitest.config.ts only includes `tests/**/*.test.ts`,
// so this file must stay plain TypeScript (React.createElement, not `.tsx`).
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace/WorkspaceProvider';

function Consumer() {
  const { workspace, isLive } = useWorkspace();
  return React.createElement('div', null, `${workspace}:${isLive}`);
}

describe('WorkspaceProvider / useWorkspace', () => {
  it('exposes the supplied sandbox workspace to consumers', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceProvider, { workspace: 'sandbox' }, React.createElement(Consumer))
    );
    expect(html).toContain('sandbox:false');
  });

  it('exposes the supplied production workspace and marks it live', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceProvider, { workspace: 'production' }, React.createElement(Consumer))
    );
    expect(html).toContain('production:true');
  });

  it('throws when useWorkspace is called outside a WorkspaceProvider', () => {
    expect(() => renderToStaticMarkup(React.createElement(Consumer))).toThrow(
      /useWorkspace\(\) must be called within a <WorkspaceProvider>/
    );
  });
});
