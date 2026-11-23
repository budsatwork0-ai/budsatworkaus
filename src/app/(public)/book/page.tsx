import { notFound, redirect } from 'next/navigation';
import { BOOK_SERVICE_CTA } from '@/app/ui/home/flags';
import { servicesPathWithQuery } from '@/app/(public)/services/lib/book-redirect';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookPage({ searchParams }: Props) {
  if (!BOOK_SERVICE_CTA) notFound();
  redirect(servicesPathWithQuery(await searchParams));
}
