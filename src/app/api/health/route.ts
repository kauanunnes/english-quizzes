import { NextResponse, connection } from 'next/server';
import { env } from '@server/env';

// Sem connection() o GET seria pré-renderizado no build (Cache Components) e não provaria que a função responde
export async function GET() {
  await connection();

  return NextResponse.json(
    {
      status: 'ok',
      version: env.APP_VERSION ?? env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
