// Roda uma vez quando uma instância do servidor sobe, antes de atender requisições
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // O build pré-renderiza sem os segredos de produção; a checagem vale quando o servidor sobe de verdade
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { assertRuntimeEnv } = await import('@server/env');
  assertRuntimeEnv();
}
