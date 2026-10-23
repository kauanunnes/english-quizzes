# 13. Setup e deploy

## 13.1 Pré-requisitos
- Node.js LTS (22 ou 24 ⚠️ alinhar com a versão padrão da Vercel no momento do setup) e pnpm.
- Contas: GitHub, Vercel (Hobby), TMDB, OpenSubtitles (conta gratuita), Anthropic (API). O Neon é criado pela Vercel.

## 13.2 Variáveis de ambiente
Validadas por Zod em `server/lib/env.ts` ao iniciar; faltando obrigatória, o servidor não sobe. O front só recebe variáveis `VITE_*`, e nenhuma delas é secreta.

| Variável | Obrigatória | Exemplo / padrão | Uso |
|---|---|---|---|
| `APP_ORIGIN` | sim | `https://segunda-tela.vercel.app` | checagem de `Origin` |
| `APP_VERSION` | não | SHA do commit (`VERCEL_GIT_COMMIT_SHA`) | `/api/health`, logs |
| `DATABASE_URL` | sim | conexão do Neon (pooled); `pglite://memory` em teste | Drizzle |
| `DATABASE_URL_UNPOOLED` | sim no build | conexão direta do Neon | migrações |
| `TMDB_READ_TOKEN` | sim | `eyJ…` | TMDB |
| `OPENSUBTITLES_API_KEY` | sim | — | cabeçalho `Api-Key` |
| `OPENSUBTITLES_USERNAME` / `OPENSUBTITLES_PASSWORD` | sim | sua conta | `/login` |
| `OPENSUBTITLES_USER_AGENT` | sim | `SegundaTela v0.1.0` | `User-Agent` |
| `OS_MODE` | não | `live` (produção) / `mock` (local, preview) | §13.4 |
| `OS_INTERACTIVE_RESERVE` | não | `5` | §4.2.10 |
| `TOKEN_ENCRYPTION_KEY` | sim | 32 bytes em base64 | sessão da OpenSubtitles |
| `ANTHROPIC_API_KEY` | sim (fora de testes) | `sk-ant-…` | LLM |
| `LLM_*` e `QUIZ_INCLUDE_PT_EXPLANATION` | não | §4.3.9 | LLM |
| `GENERATION_ACCESS_CODE` | sim em produção | frase longa | ADR-006 |
| `ADMIN_TOKEN` | sim | 32 bytes em base64 | rotas `/api/admin/*` |
| `IP_HASH_SALT` | sim | 32 bytes em base64 | hash de IP e `deviceId` |
| `DAILY_GENERATION_LIMIT` | não | `25` (produção) / `3` (preview) | ADR-006 |
| `FEATURE_UPLOAD` / `FEATURE_REPORTS` | não | `false` / `true` | MVP+ |
| `SUBDL_ENABLED` / `SUBDL_API_KEY` | não | `false` | §4.2.11 |
| `MOCK_UPSTREAMS` | não | `1` em E2E | MSW no servidor |
| `LOG_LEVEL` | não | `info` | logger |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | não | — | opcional (§13.8) |
| `TRACER_ONLY`, `TRACER_SERIES_ID`, `TRACER_SEASON`, `TRACER_EPISODE` | só na Fase 1 | — | tracer bullet |

Gerar segredos: `openssl rand -base64 32` (um para cada: `TOKEN_ENCRYPTION_KEY`, `ADMIN_TOKEN`, `IP_HASH_SALT`).

## 13.3 Como obter cada chave

**TMDB**
1. Criar conta em themoviedb.org e confirmar o e-mail.
2. Configurações da conta → API → solicitar chave do tipo desenvolvedor, aceitar os termos e preencher o formulário (nome do app, URL, descrição de uso pessoal e não comercial).
3. Copiar o **API Read Access Token** para `TMDB_READ_TOKEN`.

**OpenSubtitles**
1. Criar conta gratuita em opensubtitles.com.
2. Página de API consumers (opensubtitles.com/en/consumers) → criar consumer "SegundaTela" com uma descrição honesta do uso.
3. Copiar a API key para `OPENSUBTITLES_API_KEY`; usuário e senha da conta vão para as variáveis de login.
4. Opcional, só para desenvolvimento local: marcar o consumer como "em desenvolvimento" se a opção existir ⚠️.

**Anthropic**
1. Criar conta e organização no Console da Anthropic (acessível a partir de platform.claude.com) ⚠️ nomes de menu podem variar.
2. Configurar faturamento e um **limite de gasto mensal** (por exemplo, US$ 10).
3. Criar uma chave de API para produção e outra para preview/local; nunca reutilizar a de produção.

**Neon (via Vercel)**
1. Projeto na Vercel → Storage → criar banco Neon pelo Marketplace e ligar ao projeto; as variáveis de conexão são injetadas automaticamente ⚠️ conferir os nomes exatos e mapear para `DATABASE_URL`/`DATABASE_URL_UNPOOLED`.
2. Criar uma branch `dev` no Neon para desenvolvimento local.

**Vercel**
1. Importar o repositório do GitHub; preset Vite; build `pnpm build:vercel`; saída `dist`.
2. Cadastrar as variáveis por ambiente (Production, Preview, Development).
3. Conferir que a função de `api/[[...route]].ts` está com duração máxima de 300 s.

## 13.4 Ambientes

| Ambiente | Front/API | Banco | OpenSubtitles | LLM | Limites |
|---|---|---|---|---|---|
| Local | `pnpm dev` (Vite + `scripts/dev-server.ts`) | branch `dev` do Neon ou PGlite | `OS_MODE=mock` por padrão; `live` só quando necessário (gasta a mesma cota da conta) | `LLM_PROVIDER=fake` por padrão | — |
| Teste/CI | processo único | PGlite em memória | MSW | `fake` | — |
| Preview (PR) | Vercel preview | branch do Neon por preview ⚠️ (se a integração oferecer) ou a branch `dev` | `mock` por padrão | real, chave separada | `DAILY_GENERATION_LIMIT=3`, `LLM_DAILY_BUDGET_USD=0.20` |
| Produção | Vercel (`main`) | branch principal | `live` | real | §ADR-006 |

Preview e produção usam a **mesma conta** da OpenSubtitles se `OS_MODE=live`; por isso o preview fica em `mock` e só vira `live` para testar algo específico.

## 13.5 `vercel.json`

```json
{
  "buildCommand": "pnpm build:vercel",
  "outputDirectory": "dist",
  "functions": {
    "api/[[...route]].ts": { "maxDuration": 300 }
  },
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'sha256-REPLACE_AT_BUILD'; style-src 'self'; img-src 'self' data: https://image.tmdb.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```
⚠️ Conferir na doc atual da Vercel os nomes das chaves (`functions`, `maxDuration`, `rewrites`, `headers`) e o padrão de rota da função. O hash da CSP é substituído por um script no build.

Migrações: `build:vercel` roda `drizzle-kit migrate` antes do `vite build`. Regra: migrações sempre compatíveis com a versão anterior do código (expandir → migrar dados → contrair em outro deploy).

## 13.6 Scripts locais
```bash
pnpm install
cp .env.example .env.local      # preencher
pnpm db:migrate && pnpm db:seed # banco dev com dados sintéticos
pnpm dev                        # http://localhost:5173 (API em /api via proxy)
pnpm check                      # lint + typecheck + testes
pnpm e2e                        # Playwright com mocks
pnpm eval --configs sonnet-medium,haiku-medium   # avaliação (usa APIs reais)
```

## 13.7 CI/CD (GitHub Actions + Vercel)
Deploy pela integração Git da Vercel (preview por PR, produção ao entrar na `main`). O GitHub Actions cuida de qualidade e tarefas agendadas.

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --coverage
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm e2e
        env:
          MOCK_UPSTREAMS: '1'
          LLM_PROVIDER: fake
          DATABASE_URL: pglite://memory
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
```

```yaml
# .github/workflows/scheduled.yml
name: scheduled
on:
  schedule:
    - cron: '15 0 * * *'   # diário: pré-geração (ajustar ao horário de renovação observado)
    - cron: '0 6 * * 1'    # semanal: manutenção TMDB e expurgos
    - cron: '0 */6 * * *'  # a cada 6 h: saúde
  workflow_dispatch:
jobs:
  maintenance:
    if: github.event.schedule == '0 6 * * 1' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST "$APP_URL/api/admin/maintenance" -H "Authorization: Bearer $ADMIN_TOKEN"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
  pregen:
    if: github.event.schedule == '15 0 * * *'
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - run: |
          for i in $(seq 1 15); do
            res=$(curl -fsS -X POST "$APP_URL/api/admin/pregen/run" -H "Authorization: Bearer $ADMIN_TOKEN")
            echo "$res"
            [ "$(echo "$res" | jq -r '.processed')" = "null" ] && break
          done
        env:
          APP_URL: ${{ secrets.APP_URL }}
          ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
  health:
    if: github.event.schedule == '0 */6 * * *'
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS "$APP_URL/api/health"
        env:
          APP_URL: ${{ secrets.APP_URL }}
      - run: |
          stats=$(curl -fsS "$APP_URL/api/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
          echo "$stats" | jq -e '.today.failureRate < 0.2' > /dev/null
        env:
          APP_URL: ${{ secrets.APP_URL }}
          ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
```
Um workflow que falha gera e-mail do GitHub: esse é o alerta do MVP. Fixe as versões das actions (idealmente por SHA) e revise-as com o Dependabot.

## 13.8 Observabilidade

| Sinal | Onde | Uso |
|---|---|---|
| Logs JSON (`requestId`, `jobId`, estágio, duração, códigos) | Vercel (retenção curta no Hobby ⚠️) | depuração imediata |
| Métricas de job (tempo por estágio, erro, blocos, reparos) | `generation_jobs` | painel e tendências |
| Tokens, US$, downloads por dia | `usage_daily` | orçamento |
| Cota da OpenSubtitles | `provider_state` | tela e alertas |
| Qualidade (descartes, blocos vazios, relatos) | `quizzes.quality`, `question_reports` | §11.7 |
| Erros de front e back (opcional) | Sentry (plano gratuito ⚠️), sem PII e sem replay de sessão | exceções |
| Saúde e taxa de falha | workflow `health` (§13.7) | alerta por e-mail |

## 13.9 Custos estimados (mês típico: 30 episódios de sitcom)

| Item | Custo |
|---|---|
| Vercel Hobby | US$ 0 |
| Neon Free | US$ 0 |
| TMDB | US$ 0 (não comercial) |
| OpenSubtitles (conta gratuita) | US$ 0; VIP opcional ⚠️ preço na página do VIP |
| LLM com Sonnet 5.5 | ≈ US$ 4 (≈ US$ 0,13 por episódio, §8.11) |
| LLM com Haiku 5.5 | ≈ US$ 0,30 |
| Eval (por rodada, 5 episódios × 3 configurações) | ≈ US$ 1–2 |
| GitHub Actions | US$ 0 dentro da cota gratuita ⚠️ |
| Domínio próprio (opcional) | ≈ US$ 10–15/ano ⚠️ |
| **Total** | **≈ US$ 0,50–5/mês** |

## 13.10 Runbook

| Situação | Ação |
|---|---|
| Cota da OpenSubtitles esgotando todo dia | Conferir `usage_daily` e pré-geração; reduzir reserva/lote; avaliar VIP |
| Erro de autenticação na OpenSubtitles | Testar login manual; atualizar senha ou API key na Vercel; apagar `provider_state.opensubtitles.session` |
| LLM indisponível ou degradada | Trocar `LLM_MODEL` (ex.: para `claude-haiku-5-5`) e redeploy; quizzes prontos seguem funcionando |
| Teto diário de US$ atingido | Ver os jobs do dia; se for abuso, trocar `GENERATION_ACCESS_CODE` |
| Vazamento de chave | Revogar no provedor, gerar nova, atualizar na Vercel, redeploy; trocar `ADMIN_TOKEN`/`IP_HASH_SALT`/`TOKEN_ENCRYPTION_KEY` se afetados (trocar a chave de cifra invalida a sessão salva, o que é esperado) |
| Pedido de remoção de conteúdo | `POST /api/admin/quizzes/{id}/withdraw`; registrar data e solicitante |
| Quiz ruim reportado | Rodar `regenerate` do episódio (gasta 1 download); se repetir, revisar prompt/validador |
| Banco perto do limite | Expurgos de §5.10; quizzes `superseded` antigos podem ser apagados; avaliar plano pago do Neon |
| TMDB fora do ar | Nada a fazer: CDN serve o catálogo antigo por até 7 dias; quizzes prontos funcionam |
