import { NextResponse } from 'next/server';

// Lightweight liveness check for the Next.js frontend process.
// Uptime monitors and load balancers hit this to confirm the Node
// server is responding. No external calls — purely in-process.
export const dynamic = 'force-dynamic'; // never cache this route

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 },
  );
}
