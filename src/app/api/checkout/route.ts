import { NextResponse } from 'next/server';

/**
 * Intentional compatibility response for the obsolete pre-review checkout
 * submission endpoint. Public quotes are submitted through /api/quotes and
 * paid only after review through /pay/:quoteId.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'This checkout endpoint is deprecated. Submit a quote before payment.' },
    { status: 410 }
  );
}
