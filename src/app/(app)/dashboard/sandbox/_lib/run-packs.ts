import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { PackKind } from './types';

export function scenariosForPack(pack: PackKind) {
  return pack === 'all'
    ? SANDBOX_SCENARIOS
    : pack === 'stress'
      ? SANDBOX_SCENARIOS.filter((scenario) => scenario.slug === 'stress-agent-cascade')
      : SANDBOX_SCENARIOS.filter((scenario) => scenario.category === pack);
}

export function packLabel(pack: PackKind) {
  return pack === 'all' ? 'all scenarios' : pack === 'stress' ? 'the stress test' : `the ${pack} pack`;
}
