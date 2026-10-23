@AGENTS.md

# Segunda Tela

App web de "segunda tela" para treinar listening em inglês: o usuário escolhe um episódio (TMDB), o backend baixa a legenda (OpenSubtitles), processa só em memória e pede a uma LLM perguntas por bloco de ~5 min, sem spoiler. Interface em PT-BR; código, arquivos e endpoints em inglês.

**Stack: Next.js 16 (App Router, Cache Components) — ver ADR-014 em `docs/03-arquitetura.md`.** Os docs foram escritos para Vite + Hono; onde eles (inclusive os prompts de `docs/15-prompts-por-fase.md`) falarem em Vite, Hono, React Router, Biome, `VITE_*`, `server/` ou `api/[[...route]].ts`, use a tabela de tradução do ADR-014.

## Regras comuns (docs/15 §15.0, adaptadas ao Next.js)

1. A especificação está em `docs/`. Leia os documentos indicados na fase ANTES de codar. Não invente endpoints, parâmetros, limites ou campos de APIs externas: use os docs e as fixtures. Itens marcados ⚠️ precisam ser confirmados (doc oficial ou resposta real) antes de virar constante.
2. TypeScript strict, sem `any`. Os contratos em `src/shared/types` (Zod) são a fonte da verdade; se mudar um contrato, atualize o doc correspondente no mesmo commit.
3. Onde os docs listam casos de teste (IDs como CLN-05, SEL-01, E2E-06), escreva os testes primeiro e use o ID no nome do teste.
4. Nunca persista, logue ou commite texto de legenda. Nunca exponha segredos no front: nenhuma variável `NEXT_PUBLIC_*` sensível, e `src/server/**` nunca é importado por Client Components. Legendas reais só em `.private/` ou `eval/.cache/` (ambos no `.gitignore`).
5. Use só as dependências da stack (ADR-014 e §3.5). Para qualquer outra, pare e peça confirmação, com justificativa e uma alternativa sem dependência.
6. Commits pequenos (Conventional Commits). Não altere nada fora do escopo da fase sem avisar.
7. Antes de dizer que terminou, rode `pnpm check` (e `pnpm e2e` quando a fase tiver E2E) e corrija o que falhar.
8. Ao terminar, responda com: (a) o que foi feito, por arquivo; (b) o que ficou pendente e por quê; (c) como testar manualmente; (d) quais itens ⚠️ você confirmou, com a evidência, e quais continuam abertos.

## Convenções do Next.js neste projeto

- Antes de usar uma API do Next, leia o guia correspondente em `node_modules/next/dist/docs/` (a versão instalada muda APIs; ver `AGENTS.md`).
- Com `cacheComponents: true`: página que lê params dinâmicos precisa de `loading.tsx` ou `<Suspense>`; `usePathname` no layout fica dentro de `<Suspense>`; `GET` de route handler sem dados da requisição é pré-renderizado no build (use `connection()` quando precisar rodar a cada chamada).
- Só `src/app/**` e `src/instrumentation.ts` importam `next/*`; domínio e integrações (`src/server/**`) rodam em Node puro e são testados com Vitest.
- Jobs longos: `after()` na rota + `export const maxDuration = 300`.
- Estado do cliente persistido (Zustand) não é lido no servidor: o store usa `skipHydration` e `PreferencesSync` reidrata depois da hidratação.

## Comandos

```bash
pnpm dev            # http://localhost:3000 (MOCK_UPSTREAMS=1 dispensa chaves)
pnpm check          # lint + typecheck (next typegen + tsc) + testes
pnpm test --coverage
pnpm e2e            # Playwright (Pixel 7/Chromium e iPhone 14/WebKit); builda e sobe na porta 3100
pnpm build          # next build + check-bundle (falha se houver segredo no que vai ao navegador)
pnpm db:generate    # nova migração a partir de src/server/lib/db/schema.ts
pnpm db:migrate     # aplica migrações no Neon (DATABASE_URL_UNPOOLED)
```

Variáveis: copie `.env.example` para `.env.local`. O servidor não sobe se faltar variável obrigatória para o ambiente (`src/server/env.ts`, checado em `src/instrumentation.ts`). Sem `DATABASE_URL`, o app usa PGlite em memória com as mesmas migrações.

## Mapa de `docs/`

- `00-indice-e-premissas.md` — índice, resumo das decisões, discordâncias, premissas, decisões em aberto, glossário.
- `01-visao-geral.md` — problema, solução, objetivos, personas, métricas e escopo.
- `02-requisitos.md` — histórias US-01..US-24 com critérios de aceite e requisitos não funcionais.
- `03-arquitetura.md` — diagramas, stack e ADRs (ADR-014: Next.js no lugar de Vite + Hono).
- `04-integracoes.md` — TMDB, OpenSubtitles e LLM: endpoints, erros, retries, cota, custo.
- `05-modelo-de-dados.md` — ainda não escrito.
- `06-contrato-api.md` — ainda não escrito.
- `07-pipeline-legendas.md` — ainda não escrito.
- `08-geracao-quiz.md` — prompt, JSON Schema, validação e pós-processamento do quiz.
- `09-ui-ux.md` — telas, componentes, estados, acessibilidade e estrutura de pastas (ler com o ADR-014).
- `10-plano-execucao.md` — fases F0–F7, tarefas, critérios de aceite e riscos.
- `11-testes-avaliacao.md` — estratégia de testes, E2E e avaliação da qualidade do quiz.
- `12-seguranca-conformidade.md` — segurança, privacidade e termos de uso.
- `13-setup-deploy.md` — variáveis de ambiente, chaves, ambientes, CI/CD, custos e runbook.
- `14-backlog.md` — backlog pós-MVP.
- `15-prompts-por-fase.md` — prompts prontos por fase (ler com o ADR-014).
- `16-quizzes-compartilhados.md` — quizzes compartilhados professor → aluno, sem login (Fase 8).
