import { NextResponse } from 'next/server';

export async function GET() {
  // Mocking returning some records
  return NextResponse.json({ 
    records: [
      { id: "WA-2026-03871", topic: "Heavy Bleeding", status: "Pending Review", priority: "High" },
      { id: "WA-2026-03870", topic: "Fatigue", status: "Pending Review", priority: "Medium" }
    ]
  });
}

export async function POST(request: Request) {
  // Mocking saving a record
  const data = await request.json();
  return NextResponse.json({ success: true, recordId: "WA-NEW-001", received: data });
}
