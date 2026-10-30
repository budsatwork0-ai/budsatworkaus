import { redirect } from 'next/navigation';

// Quotes now live on the Leads page. The old list is at /dashboard/quotes/all.
export default function QuotesPage() {
  redirect('/dashboard/leads?tab=quoted');
}
