import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // TODO: implement KTR detection webhook from YOLOv8
  return NextResponse.json({ success: true });
}
