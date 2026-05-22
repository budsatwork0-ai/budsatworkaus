import { redirect } from 'next/navigation';

export default function AgentIntelPage() {
  redirect('/dashboard/mission-control?tab=activity');
}
