import type { SupabaseClient } from '@supabase/supabase-js';
import { createOrderRepository, type OrderRow } from '@/lib/orders/repository';
import { orderWorkspace } from '@/lib/orders/workspace';
import { LIVE_WORKSPACE } from '@/lib/workspace/server';
import type { Database } from '@/types/database';

export interface MinimalCrewAssignment {
  id: string;
  order_id: string;
  employee_id: string;
  status: string;
}

export interface CrewAssignment extends MinimalCrewAssignment {
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  orders?: OrderRow | null;
  [key: string]: unknown;
}

export interface CrewAssignmentContext {
  assignment: MinimalCrewAssignment;
  order: OrderRow;
}

export interface CrewRepositoryResult<T> {
  data: T;
  error: string | null;
}

export interface CrewAssignmentListResult extends CrewRepositoryResult<CrewAssignment[]> {
  count: number | null;
}

export interface CrewRepository {
  listAvailable(employeeId: string, options?: { limit?: number; offset?: number }): Promise<CrewAssignmentListResult>;
  listMine(employeeId: string, statuses: string[]): Promise<CrewRepositoryResult<CrewAssignment[]>>;
  listCompletedForEarnings(employeeId: string): Promise<CrewRepositoryResult<CrewAssignment[]>>;
  listForPipeline(employeeIds: string[]): Promise<CrewRepositoryResult<CrewAssignment[]>>;
  getOwnedAssignmentContext(assignmentId: string, employeeId: string): Promise<CrewRepositoryResult<CrewAssignmentContext | null>>;
  getOwnedDetail(assignmentId: string, employeeId: string): Promise<CrewRepositoryResult<CrewAssignment | null>>;
}

const FULL_ORDER_RELATION = 'orders!inner(*)';
const EARNINGS_ORDER_RELATION = 'orders!inner(id, service_type, customer_name, final_price, scheduled_date, environment)';
const PIPELINE_ORDER_RELATION = 'orders!inner(id, customer_name, service_type, scheduled_date, status, environment)';

export function createCrewRepository(options: { client: SupabaseClient<Database> }): CrewRepository {
  const client = options.client;
  const orders = createOrderRepository({ client });
  // Generated database types do not model the embedded relationship filters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  async function getOwnedAssignmentContext(
    assignmentId: string,
    employeeId: string,
  ): Promise<CrewRepositoryResult<CrewAssignmentContext | null>> {
    const { data: assignment, error: assignmentError } = await db
      .from('job_assignments')
      .select('id, order_id, employee_id, status')
      .eq('id', assignmentId)
      .eq('employee_id', employeeId)
      .single();

    if (assignmentError || !assignment) {
      return { data: null, error: assignmentError?.message ?? 'Assignment not found' };
    }

    const { data: order, error: orderError } = await orders.getById(assignment.order_id);
    if (orderError || !order || orderWorkspace(order) !== LIVE_WORKSPACE) {
      // Deliberately collapse missing and sandbox parents to the same result so
      // an assignment UUID cannot reveal that a sandbox order exists.
      return { data: null, error: orderError ?? 'Assignment not found' };
    }

    return { data: { assignment, order }, error: null };
  }

  return {
    async listAvailable(employeeId, { limit = 50, offset = 0 } = {}) {
      let query = db
        .from('job_assignments')
        .select(`*, ${FULL_ORDER_RELATION}`, { count: 'exact' })
        .eq('employee_id', employeeId)
        .eq('status', 'available')
        .eq('orders.environment', LIVE_WORKSPACE)
        .order('created_at', { ascending: false });

      if (limit > 0) query = query.range(offset, offset + limit - 1);
      const { data, error, count } = await query;
      return { data: data ?? [], count: count ?? null, error: error?.message ?? null };
    },

    async listMine(employeeId, statuses) {
      const { data, error } = await db
        .from('job_assignments')
        .select(`*, ${FULL_ORDER_RELATION}`)
        .eq('employee_id', employeeId)
        .in('status', statuses)
        .eq('orders.environment', LIVE_WORKSPACE)
        .order('created_at', { ascending: false });
      return { data: data ?? [], error: error?.message ?? null };
    },

    async listCompletedForEarnings(employeeId) {
      const { data, error } = await db
        .from('job_assignments')
        .select(`id, order_id, employee_id, status, completed_at, created_at, ${EARNINGS_ORDER_RELATION}`)
        .eq('employee_id', employeeId)
        .eq('status', 'completed')
        .eq('orders.environment', LIVE_WORKSPACE)
        .order('completed_at', { ascending: false });
      return { data: data ?? [], error: error?.message ?? null };
    },

    async listForPipeline(employeeIds) {
      if (employeeIds.length === 0) return { data: [], error: null };
      const { data, error } = await db
        .from('job_assignments')
        .select(`employee_id, order_id, status, created_at, ${PIPELINE_ORDER_RELATION}`)
        .in('employee_id', employeeIds)
        .eq('orders.environment', LIVE_WORKSPACE);
      return { data: data ?? [], error: error?.message ?? null };
    },

    getOwnedAssignmentContext,

    async getOwnedDetail(assignmentId, employeeId) {
      const context = await getOwnedAssignmentContext(assignmentId, employeeId);
      if (!context.data) return { data: null, error: context.error };

      const { data, error } = await db
        .from('job_assignments')
        .select('*, orders(*)')
        .eq('id', assignmentId)
        .eq('employee_id', employeeId)
        .single();
      return { data: data ?? null, error: error?.message ?? null };
    },
  };
}
