import { NextResponse } from 'next/server';
import { getMMM, getMMMForAddress } from '@/lib/geo/getMMM';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = searchParams.get('context');
  const service = searchParams.get('service');
  const address = searchParams.get('address')?.trim();
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));

  if (context !== 'ndis' || (service !== 'cleaning' && service !== 'yard')) {
    return NextResponse.json(
      { error: 'MMM detection is only available for NDIS Cleaning and NDIS Yard Care quotes.' },
      { status: 400 }
    );
  }

  if (!address && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return NextResponse.json(
      { error: 'Provide either an address query parameter or valid lat and lng query parameters.' },
      { status: 400 }
    );
  }

  try {
    const detected = address ? await getMMMForAddress(address) : await getMMM(lat, lng);
    if (!detected) {
      return NextResponse.json(
        { error: 'We could not match this address or location to an MMM 2023 region. Please choose it manually.' },
        { status: 404 }
      );
    }

    return NextResponse.json(detected);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'MMM region lookup failed. Please choose it manually.',
      },
      { status: 502 }
    );
  }
}
