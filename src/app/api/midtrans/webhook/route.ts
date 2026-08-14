import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // TODO: implement midtrans webhook logic
  return NextResponse.json({ success: true });
}
