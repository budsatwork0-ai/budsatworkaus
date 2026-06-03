import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OVERVIEW_CORE = resolve(
  __dirname,
  '../../src/app/(app)/dashboard/mission-control/_components/OverviewCore.tsx',
);

function sectionPositions(source: string): Record<string, number> {
  const patterns: Record<string, RegExp> = {
    'Business':     /SectionLabel label="Business"/,
    'Runtime':      /SectionLabel label="Runtime"/,
    'Reports':      /SectionLabel label="Reports"/,
    'ActionQueue':  /<ActionQueue/,
    'BusinessSnapshot': /<BusinessSnapshot/,
  };
  const positions: Record<string, number> = {};
  for (const [name, re] of Object.entries(patterns)) {
    const m = re.exec(source);
    positions[name] = m ? m.index : -1;
  }
  return positions;
}

describe('Mission Control layout order (Phase 6B)', () => {
  const source = readFileSync(OVERVIEW_CORE, 'utf8');
  const pos = sectionPositions(source);

  it('Business section label appears before Runtime section label', () => {
    expect(pos['Business']).toBeGreaterThan(-1);
    expect(pos['Runtime']).toBeGreaterThan(-1);
    expect(pos['Business']).toBeLessThan(pos['Runtime']);
  });

  it('BusinessSnapshot renders before ActionQueue', () => {
    expect(pos['BusinessSnapshot']).toBeGreaterThan(-1);
    expect(pos['ActionQueue']).toBeGreaterThan(-1);
    expect(pos['BusinessSnapshot']).toBeLessThan(pos['ActionQueue']);
  });

  it('ActionQueue renders before Reports section', () => {
    expect(pos['ActionQueue']).toBeGreaterThan(-1);
    expect(pos['Reports']).toBeGreaterThan(-1);
    expect(pos['ActionQueue']).toBeLessThan(pos['Reports']);
  });

  it('improvement evidence section is gated to run_improvement_pipeline approvals', () => {
    expect(source).toContain("action_type === 'run_improvement_pipeline'");
    expect(source).toContain('Evidence summary');
  });

  it('approval expand drawer still present', () => {
    expect(source).toContain('Approve');
    expect(source).toContain('Reject');
    expect(source).toContain('deriveVerdict');
  });
});

describe('Mission Control layout order (Phase 7)', () => {
  const source = readFileSync(OVERVIEW_CORE, 'utf8');

  const pos7 = {
    AgentValue:    /<AgentValue/.exec(source)?.index ?? -1,
    ActivityFeed:  /<ActivityFeed/.exec(source)?.index ?? -1,
    ActionQueue:   /<ActionQueue/.exec(source)?.index ?? -1,
  };

  it('AgentValue section exists in the component', () => {
    expect(source).toContain('function AgentValue(');
    expect(source).toContain('Agent value');
  });

  it('AgentValue renders after ActionQueue and before ActivityFeed', () => {
    expect(pos7.ActionQueue).toBeGreaterThan(-1);
    expect(pos7.AgentValue).toBeGreaterThan(-1);
    expect(pos7.ActivityFeed).toBeGreaterThan(-1);
    expect(pos7.ActionQueue).toBeLessThan(pos7.AgentValue);
    expect(pos7.AgentValue).toBeLessThan(pos7.ActivityFeed);
  });

  it('agent value section shows unavailable metrics as Not available', () => {
    expect(source).toContain('Not available');
  });

  it('Phase 6A evidence section still present', () => {
    expect(source).toContain('Evidence summary');
    expect(source).toContain("action_type === 'run_improvement_pipeline'");
  });

  it('Phase 6B business-first order still holds', () => {
    const businessPos = /SectionLabel label="Business"/.exec(source)?.index ?? -1;
    const runtimePos  = /SectionLabel label="Runtime"/.exec(source)?.index ?? -1;
    expect(businessPos).toBeLessThan(runtimePos);
  });
});

describe('Ask Bud quick commands (Phase 8A)', () => {
  const source = readFileSync(OVERVIEW_CORE, 'utf8');

  it('QUICK_COMMANDS array defines exactly 6 allowed chips', () => {
    expect(source).toContain('QUICK_COMMANDS');
    // Count entries by label keys inside the array literal
    const arrayBlock = source.slice(
      source.indexOf('const QUICK_COMMANDS'),
      source.indexOf('];', source.indexOf('const QUICK_COMMANDS')) + 2,
    );
    // count actual entries by their command: '...' values, not label: (which also appears in the type annotation)
    const entries = arrayBlock.match(/command: '/g);
    expect(entries).toHaveLength(6);
  });

  it('chips render by mapping QUICK_COMMANDS and call ask(cmd.command)', () => {
    expect(source).toContain('QUICK_COMMANDS.map(');
    expect(source).toContain('ask(cmd.command)');
  });

  it('chips are disabled when busy — duplicate clicks cannot fire a second request', () => {
    expect(source).toContain('disabled={busy}');
  });

  it('UI copy explains tracked task + approval requirement', () => {
    expect(source).toContain('Ask Bud creates a tracked task');
    expect(source).toContain('Some commands may require approval before action');
  });

  it('Improve Mission Control UX chip is present and approval gate is unchanged', () => {
    expect(source).toContain('Improve Mission Control UX');
    // Approval flow components must still be present
    expect(source).toContain('deriveVerdict');
    expect(source).toContain('Approve');
    expect(source).toContain('Reject');
  });

  it('prohibited chips are absent', () => {
    expect(source).not.toContain('Find dead agents');
    expect(source).not.toContain('Reduce costs');
    expect(source).not.toContain('Deploy anything');
  });

  it('all 6 Phase 8A chips are present', () => {
    expect(source).toContain('Investigate Customer Reply');
    expect(source).toContain('Review pending approvals');
    expect(source).toContain('Investigate stalled agents');
    expect(source).toContain('Audit Messenger leads');
    expect(source).toContain('Check quote follow-ups');
    expect(source).toContain('Improve Mission Control UX');
  });

  it('manual Ask Bud input and error state are still present', () => {
    expect(source).toContain('id="core-ask"');
    expect(source).toContain('errorMsg');
  });
});
