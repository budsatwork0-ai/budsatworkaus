import { LIVE_WORKSPACE, type Workspace } from '@/lib/workspace/server';

export class ProductionPaymentRequiredError extends Error {
  readonly code = 'production_payment_required';
  readonly status = 403;

  constructor(workspace: Workspace) {
    super(`Real payment activity is disabled in the ${workspace} workspace`);
    this.name = 'ProductionPaymentRequiredError';
  }
}

export function requireProductionPaymentWorkspace(workspace: Workspace): void {
  if (workspace !== LIVE_WORKSPACE) throw new ProductionPaymentRequiredError(workspace);
}
