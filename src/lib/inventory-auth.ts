import type { NextRequest } from 'next/server';
import { getServerCaller } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

export function createInventoryClient() {
  return integrationAdminClient();
}

export async function getInventoryCallerRole(request: NextRequest): Promise<string | null> {
  const caller = await getServerCaller(request);
  return caller?.role ?? null;
}