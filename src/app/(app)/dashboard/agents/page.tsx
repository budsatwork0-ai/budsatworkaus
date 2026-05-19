/**
 * /dashboard/agents has been unified into Buds OS Mission Control.
 * Redirect to the Workforce tab of /dashboard/mission-control.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AgentsRedirect() {
  redirect('/dashboard/mission-control?tab=workforce');
}
