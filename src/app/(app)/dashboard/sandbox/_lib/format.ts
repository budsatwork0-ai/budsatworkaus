import type { ScenarioCategory, ScenarioDifficulty } from '@/lib/sandbox/scenarios';
import type { RunResult } from './types';

export const CATEGORY_COLOURS: Record<ScenarioCategory, string> = {
  customer: 'bg-blue-100 text-blue-800',
  participant: 'bg-purple-100 text-purple-800',
  marketplace: 'bg-amber-100 text-amber-800',
  ndis: 'bg-teal-100 text-teal-800',
  ops: 'bg-orange-100 text-orange-800',
  growth: 'bg-emerald-100 text-emerald-800',
  finance: 'bg-rose-100 text-rose-800',
};

export const DIFFICULTY_COLOURS: Record<ScenarioDifficulty, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
};

export function isPass(result: RunResult): boolean {
  return result.status !== 'failed' && result.score.f1Score >= 0.5;
}

export function fmtF1(value: number | null): string {
  return value === null ? '-' : Number(value).toFixed(2);
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function pctRatio(numerator: number, denominator: number): string {
  if (denominator === 0) return '-';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function difficultyRank(difficulty: ScenarioDifficulty): number {
  return difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
}

export function scenarioCategories(): ScenarioCategory[] {
  return ['customer', 'participant', 'marketplace', 'ndis', 'ops', 'growth', 'finance'];
}
