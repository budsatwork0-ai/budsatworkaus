import type { AutonomyLevel, BudTask } from './types';

export type BudCommandIntent =
  | 'investigate'
  | 'fix'
  | 'improve'
  | 'schedule'
  | 'quote'
  | 'review'
  | 'deploy'
  | 'general';

export type ClassifiedBudCommand = {
  intent: BudCommandIntent;
  risk_level: BudTask['risk_level'];
  autonomy_level: AutonomyLevel;
  needs_approval: boolean;
  action_type: string;
  description: string;
};

export function classifyBudCommand(command: string): ClassifiedBudCommand {
  const value = command.trim();
  const lower = value.toLowerCase();

  let intent: BudCommandIntent = 'general';
  if (/\b(deploy|release|ship)\b/.test(lower)) intent = 'deploy';
  else if (/\b(fix|repair|broken|bug|failing|failure)\b/.test(lower)) intent = 'fix';
  else if (/\b(investigate|check why|find issues|debug|diagnose)\b/.test(lower)) intent = 'investigate';
  else if (/\b(improve|redesign|simplify|declutter|conversion|layout|ux)\b/.test(lower)) intent = 'improve';
  else if (/\b(schedule|jobs|run sheet|today)\b/.test(lower)) intent = 'schedule';
  else if (/\b(quote|quotes|pricing|price)\b/.test(lower)) intent = 'quote';
  else if (/\b(review|audit)\b/.test(lower)) intent = 'review';

  const risk_level: BudTask['risk_level'] =
    intent === 'deploy' ? 'high'
    : intent === 'fix' ? 'medium'
    : intent === 'improve' ? 'medium'
    : 'low';

  const autonomy_level: AutonomyLevel =
    intent === 'deploy' ? 2
    : intent === 'fix' || intent === 'improve' ? 2
    : 1;

  const needs_approval = intent === 'deploy' || intent === 'fix' || intent === 'improve';

  return {
    intent,
    risk_level,
    autonomy_level,
    needs_approval,
    action_type:
      intent === 'deploy' ? 'approve_deployment_plan'
      : intent === 'fix' ? 'approve_repair_plan'
      : intent === 'improve' ? 'approve_ux_evolution_plan'
      : 'review_bud_command',
    description: `Bud command: ${value}`,
  };
}
