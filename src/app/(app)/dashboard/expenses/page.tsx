import { redirect } from 'next/navigation';

export default function ExpensesRedirect() {
  redirect('/dashboard/invoices');
}
