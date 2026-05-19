import type { AutonomyLevel } from './types';

const DANGEROUS_ACTIONS = new Set([
  'delete_records',
  'mass_email',
  'financial_transfer',
  'ddl_sql',
  'modify_pricing',
  'modify_ndis',
  'modify_compliance',
]);

export function canExecuteAtLevel(
  level: AutonomyLevel,
  confidence: number,
  risk_level: string,
): boolean {
  if (level === 0) return false;
  if (level === 1) return false;
  if (level === 2) return true;
  if (level === 3) return confidence >= 0.8 && ['low', 'medium'].includes(risk_level);
  if (level === 4) return confidence >= 0.85 && ['low', 'medium'].includes(risk_level);
  if (level === 5) return confidence >= 0.95 && risk_level === 'low';
  return false;
}

export function requiresApproval(
  level: AutonomyLevel,
  confidence: number,
  risk_level: string,
  action_type?: string,
): boolean {
  if (action_type && DANGEROUS_ACTIONS.has(action_type)) return true;
  if (risk_level === 'critical') return true;
  if (level <= 1) return true;
  if (level === 2) return false;
  if (level === 3) return !(confidence >= 0.8 && ['low', 'medium'].includes(risk_level));
  if (level === 4) return !(confidence >= 0.85 && ['low', 'medium'].includes(risk_level));
  if (level === 5) return !(confidence >= 0.95 && risk_level === 'low');
  return true;
}

export function isDangerousAction(action_type: string): boolean {
  return DANGEROUS_ACTIONS.has(action_type);
}

export function getDefaultAutonomyLevel(): AutonomyLevel {
  const env = process.env.BUD_AUTONOMY_LEVEL;
  const parsed = env ? parseInt(env, 10) : 2;
  if (parsed >= 0 && parsed <= 5) return parsed as AutonomyLevel;
  return 2;
}
