# 6. Contrato da API do backend

Fonte da verdade: os schemas Zod em `shared/contracts/*.ts`. Este documento descreve o contrato; os testes de contrato (§6.8) garantem que o código o cumpre.

## 6.1 Convenções

| Tema | Regra |
|---|---|
| Base | `/api`, mesmo domínio da SPA (sem CORS) |
| Formato | JSON UTF-8, chaves em camelCase; datas ISO 8601 em UTC; durações em ms; IDs internos UUID v4; IDs da TMDB como inteiros |
| Cabeçalhos de requisição | `X-Device-Id` (UUID do aparelho; obrigatório nos `POST`, recomendado nos `GET`); `X-Access-Code` (geração e upload); `Authorization: Bearer <ADMIN_TOKEN>` (admin) |
| Cabeçalhos de resposta | `X-Request-Id` sempre; `Cache-Control` por rota; `ETag` no quiz; `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch em segundos) nas rotas com limite; `Retry-After` em 429 e 503 |
| Erros | `application/problem+json` (RFC 9457) com as extensões `code`, `requestId` e, quando fizer sentido, `retryAfterSec`, `resetAt` e `fields` |
| Validação | Toda entrada passa por Zod; falha vira `400 INVALID_INPUT` com `fields: [{ path, message }]` |
| Origem | `POST` exige `Origin` igual a `APP_ORIGIN` (exceto admin com bearer) → senão `403 FORBIDDEN_ORIGIN` |
| Limites de corpo | JSON ≤ 16 KB; upload ≤ 1 MB |
| Versão | Rotas sem versão no MVP; o documento do quiz carrega `schemaVersion`. Mudança incompatível → `/api/v2` |

Parâmetros de caminho: `seriesId` inteiro 1..2.147.483.647; `seasonNumber` inteiro 0..200; `episodeNumber` inteiro 1..5.000. `episodeKey` derivado: `tmdb-{seriesId}-s{SS}-e{EE}` (zero à esquerda até 2 dígitos).

## 6.2 Endpoints

| Método | Rota | Autenticação | Cache | Limite (ADR-006) | Sucesso | Erros principais |
|---|---|---|---|---|---|---|
| GET | `/api/health` | — | `no-store` | — | 200 | — |
| GET | `/api/config` | — | `public, s-maxage=604800` | `read:ip` | 200 | — |
| GET | `/api/series/search?q=&page=` | — | `public, s-maxage=3600, stale-while-revalidate=86400` | `read:ip` | 200 | 400, 429, 502, 503, 504 |
| GET | `/api/series/{seriesId}` | — | `public, s-maxage=86400, stale-while-revalidate=604800` | `read:ip` | 200 | 404 `SERIES_NOT_FOUND` |
| GET | `/api/series/{seriesId}/seasons/{seasonNumber}` | — | idem | `read:ip` | 200 | 404 `SEASON_NOT_FOUND` |
| GET | `/api/series/{seriesId}/seasons/{seasonNumber}/quiz-status` | — | `no-store` | `read:ip` | 200 | 400 |
| GET | `/api/episodes/{seriesId}/{seasonNumber}/{episodeNumber}/quiz` | — | `private, max-age=60` + `ETag` | `read:ip` | 200, 304 | 404 `QUIZ_NOT_FOUND` |
| POST | `/api/episodes/{seriesId}/{seasonNumber}/{episodeNumber}/quiz` | `X-Access-Code` | `no-store` | `gen:*` | 200 (já pronto), 202 (job) | 401, 403, 422, 429, 503 |
| POST | `/api/episodes/{seriesId}/{seasonNumber}/{episodeNumber}/quiz/upload` [MVP+] | `X-Access-Code` | `no-store` | `upload:ip`, `gen:*` | 202 | 401, 413, 415, 429, 503 |
| GET | `/api/jobs/{jobId}` | — | `no-store` | `read:ip` | 200 | 404 `JOB_NOT_FOUND` |
| GET | `/api/quota` | — | `no-store` | `read:ip` | 200 | — |
| POST | `/api/access/verify` | `X-Access-Code` | `no-store` | `access-code-fail:ip` | 204 | 401 `ACCESS_CODE_INVALID`, 429 |
| POST | `/api/quizzes/{quizId}/questions/{questionId}/reports` [MVP+] | `X-Device-Id` | `no-store` | `report:device` (20/dia) | 201 | 400, 404, 429 |
| POST | `/api/admin/pregen` [MVP+] | Bearer | `no-store` | — | 202 | 401 `ADMIN_UNAUTHORIZED` |
| POST | `/api/admin/pregen/run` [MVP+] | Bearer | `no-store` | — | 200 | 401 |
| POST | `/api/admin/maintenance` | Bearer | `no-store` | — | 200 | 401 |
| GET | `/api/admin/stats` [MVP+] | Bearer | `no-store` | — | 200 | 401 |
| POST | `/api/admin/quizzes/{quizId}/withdraw` | Bearer | `no-store` | — | 200 | 401, 404 |
| POST | `/api/admin/episodes/{seriesId}/{seasonNumber}/{episodeNumber}/regenerate` | Bearer | `no-store` | — | 202 | 401, 503 |

Por que o quiz não usa a CDN: um quiz retirado (`withdraw`) precisa sumir na hora; a leitura no Postgres é barata e o `ETag` evita rebaixar até ~80 KB pelo celular.

## 6.3 DTOs (Zod)

```ts
// shared/contracts/catalog.ts
import { z } from 'zod';

export const Lang = z.enum(['pt-BR', 'en']);

export const SeriesSummary = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  originalName: z.string(),
  firstAirYear: z.number().int().nullable(),
  posterPath: z.string().nullable(),        // caminho da TMDB; URL montada no front
  originalLanguage: z.string(),             // 'en'
  overview: z.string(),                     // pode ser ''
  overviewLang: Lang,
});

export const SeriesSearchResponse = z.object({
  query: z.string(),
  page: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  totalResults: z.number().int().nonnegative(),
  results: z.array(SeriesSummary),
});

export const SeasonSummary = z.object({
  seasonNumber: z.number().int().nonnegative(),
  name: z.string(),
  episodeCount: z.number().int().nonnegative(),
  airDate: z.string().nullable(),
  posterPath: z.string().nullable(),
});

export const SeriesDetail = SeriesSummary.extend({
  backdropPath: z.string().nullable(),
  lastAirYear: z.number().int().nullable(),
  numberOfSeasons: z.number().int().nonnegative(),
  seasons: z.array(SeasonSummary),           // temporada 0 por último
});

export const EpisodeSummary = z.object({
  episodeKey: z.string(),
  tmdbEpisodeId: z.number().int(),
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  name: z.string(),
  nameLang: Lang,
  overview: z.string(),
  overviewLang: Lang,
  stillPath: z.string().nullable(),
  runtimeMin: z.number().int().nullable(),
  airDate: z.string().nullable(),
});

export const SeasonDetail = z.object({
  seriesId: z.number().int(),
  seasonNumber: z.number().int(),
  name: z.string(),
  episodes: z.array(EpisodeSummary),
});

export const AppConfig = z.object({
  imageBaseUrl: z.string().url(),            // ex.: https://image.tmdb.org/t/p/
  posterSizes: z.array(z.string()),
  stillSizes: z.array(z.string()),
  appVersion: z.string(),
  accessCodeRequired: z.boolean(),
  features: z.object({ upload: z.boolean(), reports: z.boolean() }),
});
```

```ts
// shared/contracts/generation.ts
import { z } from 'zod';
import { QuizDocument } from './quiz';
import { ErrorCode } from './errors';

export const QuizAvailability = z.enum(['ready', 'generating', 'none', 'no_subtitle', 'failed']);

export const SeasonQuizStatus = z.object({
  seriesId: z.number().int(),
  seasonNumber: z.number().int(),
  episodes: z.array(z.object({
    episodeNumber: z.number().int(),
    status: QuizAvailability,
    quizId: z.string().uuid().nullable(),
    jobId: z.string().uuid().nullable(),
    lastErrorCode: ErrorCode.nullable(),
    updatedAt: z.string().datetime().nullable(),
  })),
});

export const QuizResponse = z.object({
  quizId: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  episode: z.object({                         // de `episodes` (pode ser null após 170 dias)
    seriesName: z.string().nullable(),
    episodeName: z.string().nullable(),
    runtimeMin: z.number().int().nullable(),
  }),
  quiz: QuizDocument,
});

export const GenerateQuizBody = z.object({ force: z.boolean().default(false) }).strict();

export const GenerateQuizReady = z.object({
  status: z.literal('ready'), quizId: z.string().uuid(), version: z.number().int(),
});
export const GenerateQuizAccepted = z.object({
  status: z.enum(['queued', 'running']), jobId: z.string().uuid(), pollAfterMs: z.number().int(),
});

export const JobStage = z.enum(['queued', 'resolving', 'searching', 'downloading', 'parsing',
  'generating', 'validating', 'ready', 'failed']);

export const JobStatus = z.object({
  jobId: z.string().uuid(),
  episodeKey: z.string(),
  status: z.enum(['queued', 'running', 'ready', 'failed']),
  stage: JobStage,
  progress: z.number().int().min(0).max(100),
  segments: z.object({ done: z.number().int(), total: z.number().int() }).nullable(),
  quizId: z.string().uuid().nullable(),
  error: z.object({
    code: ErrorCode,
    message: z.string(),                        // PT-BR, pronto para a UI
    retryAfterSec: z.number().int().optional(),
    resetAt: z.string().datetime().optional(),
  }).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pollAfterMs: z.number().int().nullable(),     // null em estado terminal
});

export const QuotaResponse = z.object({
  subtitles: z.object({
    remaining: z.number().int().nullable(),     // null = desconhecido
    resetAt: z.string().datetime().nullable(),
    observedAt: z.string().datetime().nullable(),
    reserve: z.number().int(),                  // reserva interativa
  }),
  generations: z.object({ usedToday: z.number().int(), limitToday: z.number().int() }),
  llm: z.object({ spentTodayUsd: z.number(), budgetTodayUsd: z.number() }),
  accessCodeRequired: z.boolean(),
});

export const ReportBody = z.object({
  reason: z.enum(['wrong_answer', 'visual', 'spoiler', 'confusing', 'other']),
  comment: z.string().max(280).optional(),
}).strict();

export const PregenEnqueueBody = z.object({
  seriesId: z.number().int().positive(),
  seasonNumber: z.number().int().nonnegative(),
  episodes: z.array(z.number().int().positive()).max(50).optional(),   // omitido = temporada inteira
  priority: z.number().int().min(1).max(1000).default(100),
}).strict();
```

```ts
// shared/contracts/errors.ts
import { z } from 'zod';

export const ErrorCode = z.enum([
  'INVALID_INPUT', 'FORBIDDEN_ORIGIN',
  'ACCESS_CODE_REQUIRED', 'ACCESS_CODE_INVALID', 'ADMIN_UNAUTHORIZED',
  'SERIES_NOT_FOUND', 'SEASON_NOT_FOUND', 'EPISODE_NOT_FOUND', 'QUIZ_NOT_FOUND', 'JOB_NOT_FOUND',
  'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_SUBTITLE_FORMAT',
  'SUBTITLE_NOT_FOUND', 'SUBTITLE_UNUSABLE',
  'RATE_LIMITED', 'EPISODE_RETRY_LIMIT',
  'SUBTITLE_QUOTA_EXCEEDED', 'GENERATION_LIMIT_REACHED', 'BUDGET_EXCEEDED',
  'UPSTREAM_AUTH_FAILED', 'UPSTREAM_RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT',
  'LLM_FAILED', 'QUALITY_CHECK_FAILED', 'JOB_STALLED', 'JOB_DEADLINE_EXCEEDED',
  'INTERNAL',
]);

export const Problem = z.object({
  type: z.string(),                 // https://segunda-tela.app/errors/<code-em-kebab>
  title: z.string(),
  status: z.number().int(),
  code: ErrorCode,
  detail: z.string().optional(),
  requestId: z.string(),
  retryAfterSec: z.number().int().optional(),
  resetAt: z.string().datetime().optional(),
  fields: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
```

## 6.4 Comportamento por endpoint

### `GET /api/series/search?q=&page=`
- `q`: 2–100 caracteres após `trim`; `page`: 1–500 (padrão 1).
- Repassa para `GET /search/tv` (pt-BR, sem conteúdo adulto) e normaliza (§4.1.3).

```json
{
  "query": "victorious",
  "page": 1,
  "totalPages": 1,
  "totalResults": 1,
  "results": [
    {
      "id": 1234,
      "name": "Brilhante Victória",
      "originalName": "Victorious",
      "firstAirYear": 2010,
      "posterPath": "/abc123.jpg",
      "originalLanguage": "en",
      "overview": "…",
      "overviewLang": "pt-BR"
    }
  ]
}
```
(Valores ilustrativos; o ID real vem da busca.)

### `GET /api/series/{seriesId}/seasons/{seasonNumber}`
Duas chamadas à TMDB (pt-BR e, se houver campos vazios, en-US), mescladas.

```json
{
  "seriesId": 1234,
  "seasonNumber": 1,
  "name": "Temporada 1",
  "episodes": [
    {
      "episodeKey": "tmdb-1234-s01-e01",
      "tmdbEpisodeId": 98765,
      "seasonNumber": 1,
      "episodeNumber": 1,
      "name": "Pilot",
      "nameLang": "en",
      "overview": "…",
      "overviewLang": "pt-BR",
      "stillPath": "/def456.jpg",
      "runtimeMin": 22,
      "airDate": "2010-03-27"
    }
  ]
}
```

### `GET /api/series/{seriesId}/seasons/{seasonNumber}/quiz-status`
Consulta da §5.4; separado do endpoint acima para que o catálogo continue cacheável.

```json
{
  "seriesId": 1234,
  "seasonNumber": 1,
  "episodes": [
    { "episodeNumber": 1, "status": "ready", "quizId": "7f2c…", "jobId": null, "lastErrorCode": null, "updatedAt": "2026-10-23T22:10:00Z" },
    { "episodeNumber": 2, "status": "generating", "quizId": null, "jobId": "c41a…", "lastErrorCode": null, "updatedAt": "2026-10-23T22:12:30Z" },
    { "episodeNumber": 4, "status": "no_subtitle", "quizId": null, "jobId": null, "lastErrorCode": "SUBTITLE_NOT_FOUND", "updatedAt": "2026-10-23T21:00:00Z" }
  ]
}
```
Episódios sem linha no banco não aparecem; o front trata ausência como `none`.

### `GET /api/episodes/{seriesId}/{seasonNumber}/{episodeNumber}/quiz`
- `200` com `QuizResponse` (o documento completo do quiz está no item 5; exemplos de perguntas no item 8). `ETag: "<quizId>-v<version>"`; `If-None-Match` igual → `304`.
- `404 QUIZ_NOT_FOUND` quando não há quiz `ready` (não cacheado).

### `POST /api/episodes/{seriesId}/{seasonNumber}/{episodeNumber}/quiz`
Ordem de checagens (barata → cara):
1. `Origin`, `X-Device-Id` e corpo válidos.
2. Código de acesso (`ACCESS_CODE_REQUIRED` / `ACCESS_CODE_INVALID`; erros contam no bucket `access-code-fail:ip`).
3. Já existe quiz `ready` → `200 GenerateQuizReady` (nada é gerado).
4. Já existe job ativo → `202` com o mesmo `jobId`.
5. Episódio marcado `no_subtitle` há < 24 h e `force: false` → `422 SUBTITLE_NOT_FOUND`.
6. 2 downloads do episódio nas últimas 24 h → `429 EPISODE_RETRY_LIMIT`.
7. Rate limit `gen:ip`/`gen:device` → `429 RATE_LIMITED`; teto `gen:global` → `503 GENERATION_LIMIT_REACHED`.
8. Cota conhecida esgotada → `503 SUBTITLE_QUOTA_EXCEEDED` (com `resetAt` e `Retry-After`).
9. Orçamento de LLM do dia esgotado → `503 BUDGET_EXCEEDED`.
10. `upsert` mínimo em `episodes` (IDs e números), criação idempotente do job (§5.4), `waitUntil(runJob)`, resposta `202`.

```json
{ "status": "queued", "jobId": "c41a5e0b-3b7e-4b8a-9d1f-1a2b3c4d5e6f", "pollAfterMs": 2000 }
```

### `POST …/quiz/upload` [MVP+]
`multipart/form-data` com `file` (`.srt`/`.vtt`, ≤ 1 MB) e `confirmRights=true`. Mesmas checagens 1–3 e 7–9 do `POST` de geração. Os bytes seguem só em memória para o `waitUntil` (nunca para disco ou banco). Resposta `202` como acima. Erros extras: `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_SUBTITLE_FORMAT`, `400 INVALID_INPUT` (sem `confirmRights`).

### `GET /api/jobs/{jobId}`
Se o job está ativo e `heartbeat_at` passou de 90 s, o backend o marca `failed` (`JOB_STALLED`) antes de responder (ADR-005).

```json
{
  "jobId": "c41a5e0b-3b7e-4b8a-9d1f-1a2b3c4d5e6f",
  "episodeKey": "tmdb-1234-s01-e02",
  "status": "running",
  "stage": "generating",
  "progress": 65,
  "segments": { "done": 2, "total": 4 },
  "quizId": null,
  "error": null,
  "createdAt": "2026-10-23T22:12:30Z",
  "updatedAt": "2026-10-23T22:13:05Z",
  "pollAfterMs": 4000
}
```

```json
{
  "jobId": "0b9d…",
  "episodeKey": "tmdb-1234-s01-e05",
  "status": "failed",
  "stage": "failed",
  "progress": 25,
  "segments": null,
  "quizId": null,
  "error": {
    "code": "SUBTITLE_QUOTA_EXCEEDED",
    "message": "A cota diária de legendas acabou. Os quizzes já gerados continuam disponíveis.",
    "retryAfterSec": 18000,
    "resetAt": "2026-10-23T23:59:59Z"
  },
  "createdAt": "2026-10-23T18:59:00Z",
  "updatedAt": "2026-10-23T18:59:04Z",
  "pollAfterMs": null
}
```

### `GET /api/quota`
```json
{
  "subtitles": { "remaining": 14, "resetAt": "2026-10-23T23:59:59Z", "observedAt": "2026-10-23T22:13:01Z", "reserve": 5 },
  "generations": { "usedToday": 6, "limitToday": 25 },
  "llm": { "spentTodayUsd": 0.41, "budgetTodayUsd": 1.0 },
  "accessCodeRequired": true
}
```

### `POST /api/access/verify`
Valida o código antes de guardá-lo no aparelho. `204` se válido; `401 ACCESS_CODE_INVALID` se não. Cada erro conta no bucket `access-code-fail:ip` (5/h).

### Admin
- `POST /api/admin/pregen` (`PregenEnqueueBody`) → `202 { "enqueued": 13, "skippedExisting": 7 }`. Episódios com quiz pronto não entram.
- `POST /api/admin/pregen/run` → processa **um** item pendente de forma síncrona (até 240 s), só se `remaining − reserve > 0` e houver orçamento. Resposta: `{ "processed": "tmdb-1234-s01-e03" | null, "result": "ready" | "failed" | "skipped", "errorCode": null, "pendingLeft": 12, "quotaRemaining": 13 }`. O GitHub Actions chama em laço enquanto `pendingLeft > 0` e `processed != null` (item 13).
- `POST /api/admin/maintenance` → renova/anula metadados da TMDB (§5.7) e expurga dados antigos (§5.10). Resposta com contagens.
- `GET /api/admin/stats` → `{ today, last30Days, quota, storage: { quizzes, approxMb } }` a partir de `usage_daily`, `generation_jobs` e `provider_state`.
- `POST /api/admin/quizzes/{quizId}/withdraw` → `status = 'withdrawn'` (atende pedidos de remoção; o próximo `GET` devolve 404).
- `POST /api/admin/episodes/{…}/regenerate` → cria job com `force`; ao terminar, a versão anterior vira `superseded`.

## 6.5 Catálogo de erros

| Código | HTTP | Onde aparece | Repetir? | Mensagem na UI (PT-BR) |
|---|---|---|---|---|
| `INVALID_INPUT` | 400 | qualquer rota | não | "Algo saiu errado com o pedido. Atualize a página." |
| `FORBIDDEN_ORIGIN` | 403 | `POST` | não | "Pedido bloqueado por segurança." |
| `ACCESS_CODE_REQUIRED` | 401 | geração/upload | após informar | "Digite o código de acesso para gerar quizzes." |
| `ACCESS_CODE_INVALID` | 401 | geração/upload/verify | após corrigir | "Código inválido." |
| `ADMIN_UNAUTHORIZED` | 401 | admin | não | — |
| `SERIES_NOT_FOUND` / `SEASON_NOT_FOUND` / `EPISODE_NOT_FOUND` | 404 | catálogo, job | não | "Não encontramos essa série/temporada/episódio." |
| `QUIZ_NOT_FOUND` | 404 | `GET …/quiz` | — | (estado normal: mostra "Gerar quiz") |
| `JOB_NOT_FOUND` | 404 | `GET /jobs/:id` | não | "Esse processamento não existe mais. Tente gerar de novo." |
| `PAYLOAD_TOO_LARGE` | 413 | upload | não | "O arquivo passa de 1 MB." |
| `UNSUPPORTED_SUBTITLE_FORMAT` | 415 | upload, job | não | "Envie um arquivo .srt ou .vtt." |
| `SUBTITLE_NOT_FOUND` | 422 / job | `POST` (recente), job | após 24 h ou com "Buscar de novo" | "Não achamos legenda em inglês para este episódio." |
| `SUBTITLE_UNUSABLE` | 422 / job | job | outro candidato já foi tentado | "A legenda encontrada parece incompleta ou de outro episódio." |
| `RATE_LIMITED` | 429 | qualquer rota com limite | após `Retry-After` | "Muitos pedidos em pouco tempo. Tente em alguns minutos." |
| `EPISODE_RETRY_LIMIT` | 429 | `POST` | após 24 h | "Este episódio já foi tentado duas vezes hoje." |
| `SUBTITLE_QUOTA_EXCEEDED` | 503 / job | `POST`, job | após `resetAt` | "A cota diária de legendas acabou. Renova às {hora local}." |
| `GENERATION_LIMIT_REACHED` | 503 | `POST` | amanhã (UTC) | "O limite de gerações de hoje foi atingido." |
| `BUDGET_EXCEEDED` | 503 / job | `POST`, job | amanhã (UTC) | "O limite de uso da IA de hoje foi atingido." |
| `UPSTREAM_AUTH_FAILED` | 502 / job | catálogo, job | não (configuração) | "Problema de configuração no servidor. Já fomos avisados." |
| `UPSTREAM_RATE_LIMITED` | 503 / job | catálogo, job | após `Retry-After` | "O serviço externo pediu uma pausa. Tente em instantes." |
| `UPSTREAM_UNAVAILABLE` | 503 / job | catálogo, job | sim | "Um serviço externo está fora do ar. Tente de novo." |
| `UPSTREAM_TIMEOUT` | 504 / job | catálogo, job | sim | "O serviço externo demorou demais. Tente de novo." |
| `LLM_FAILED` | job | job | sim | "Não conseguimos criar as perguntas agora. Tente de novo." |
| `QUALITY_CHECK_FAILED` | job | job | sim (pode variar) | "As perguntas não passaram na conferência de qualidade. Tente de novo." |
| `JOB_STALLED` / `JOB_DEADLINE_EXCEEDED` | job | job | sim | "O processamento foi interrompido. Tente de novo." |
| `INTERNAL` | 500 | qualquer | sim | "Erro inesperado. Tente de novo." |

"job" = o código aparece em `JobStatus.error`, com HTTP 200 na consulta do job.

Exemplo de resposta de erro:
```json
{
  "type": "https://segunda-tela.app/errors/rate-limited",
  "title": "Muitos pedidos",
  "status": 429,
  "code": "RATE_LIMITED",
  "detail": "Limite de 5 gerações por hora por aparelho.",
  "requestId": "req_01J9Z4X7K2",
  "retryAfterSec": 1260
}
```

## 6.6 Estágios do job e polling

| `stage` | `progress` | Mensagem na UI |
|---|---|---|
| `queued` | 0 | "Na fila…" |
| `resolving` | 5 | "Identificando o episódio…" |
| `searching` | 15 | "Procurando legenda em inglês…" |
| `downloading` | 25 | "Baixando a legenda…" |
| `parsing` | 35 | "Limpando o texto…" |
| `generating` | 40 → 90, proporcional aos blocos prontos | "Criando perguntas ({done}/{total} blocos)…" |
| `validating` | 95 | "Conferindo as perguntas…" |
| `ready` | 100 | "Pronto!" |
| `failed` | último valor | mensagem do código de erro |

- `pollAfterMs`: 2.000 nos primeiros 20 s do job, depois 4.000; `null` em estado terminal.
- O front usa `refetchInterval` do TanStack Query com esse valor, sem polling com a aba oculta (padrão da biblioteca) e com `refetchOnWindowFocus` para retomar ao voltar.
- Ao virar `ready`: o front invalida `quiz-status` da temporada e busca o quiz.

## 6.7 Esqueleto do app Hono

```ts
// server/app.ts
import { Hono } from 'hono';

export const app = new Hono<{ Variables: { requestId: string; deviceHash?: string; ipHash: string } }>()
  .basePath('/api')
  .use('*', requestIdMiddleware(), structuredLogger(), securityHeaders(), clientIdentity())
  .get('/health', (c) => c.json({ status: 'ok', version: env.APP_VERSION, time: new Date().toISOString() }))
  .get('/config', configHandler)
  .route('/series', seriesRoutes)       // search, detail, season, quiz-status
  .route('/episodes', episodeRoutes)    // GET/POST quiz, upload
  .route('/jobs', jobRoutes)
  .route('/quizzes', reportRoutes)
  .route('/access', accessRoutes)
  .get('/quota', quotaHandler)
  .route('/admin', adminRoutes)         // middleware de bearer dentro
  .notFound((c) => problem(c, 404, 'INVALID_INPUT', 'Rota inexistente'))
  .onError(problemErrorHandler);        // AppError → Problem; desconhecido → INTERNAL (sem vazar detalhes)
```
`api/[[...route]].ts` só importa `app` e o expõe para a Vercel; `scripts/dev-server.ts` serve o mesmo `app` com `@hono/node-server`.

## 6.8 Testes de contrato
Rodam em processo (`app.request()`), com upstreams simulados por MSW (respostas gravadas na Fase 1) e banco PGlite.

- [ ] Cada rota: resposta de sucesso valida no schema Zod correspondente; erro valida em `Problem`.
- [ ] Cabeçalhos: `Cache-Control` exato por rota; `X-Request-Id` sempre; `ETag`/`304` no quiz.
- [ ] `POST` de geração: as 10 checagens de §6.4 em ordem, uma por teste (código ausente, inválido, quiz pronto, job ativo, `no_subtitle` recente, limite por episódio, rate limit, teto global, cota, orçamento).
- [ ] Idempotência: dois `POST` simultâneos do mesmo episódio → mesmo `jobId`.
- [ ] Job travado: `heartbeat_at` antigo → `JOB_STALLED` na leitura.
- [ ] Upload: > 1 MB → 413; `.ass` → 415; sem `confirmRights` → 400.
- [ ] Admin sem bearer → 401 em todas as rotas `/api/admin/*`.
- [ ] Nenhuma resposta de erro contém texto de legenda nem mensagem crua de upstream.
