# 15. Prompts prontos por fase

Como usar: cole o prompt da fase no assistente de código (Claude Code, Cursor etc.) com o repositório aberto. Os prompts referenciam `docs/` e assumem que §15.0 também está copiado no `CLAUDE.md` (criado na Fase 0), para que toda sessão carregue as regras. Uma fase por sessão; revise o resultado antes da próxima.

## 15.0 Regras comuns

```text
REGRAS COMUNS — valem para todas as fases
1. A especificação está em docs/. Leia os documentos indicados na fase ANTES de codar. Não invente endpoints, parâmetros, limites ou campos de APIs externas: use os docs e as fixtures. Itens marcados ⚠️ precisam ser confirmados (doc oficial ou resposta real) antes de virar constante.
2. TypeScript strict, sem any implícito. Os contratos em shared/contracts (Zod) são a fonte da verdade; se mudar um contrato, atualize o doc correspondente no mesmo commit.
3. Onde os docs listam casos de teste (IDs como CLN-05, SEL-01, E2E-06), escreva os testes primeiro e use o ID no nome do teste.
4. Nunca persista, logue ou commite texto de legenda. Nunca exponha segredos no front (nenhuma variável VITE_* sensível). Legendas reais só em .private/ ou eval/.cache/, ambos no .gitignore.
5. Use só as dependências da stack (docs/03-arquitetura.md §3.5). Para qualquer outra, pare e peça confirmação, com justificativa e uma alternativa sem dependência.
6. Commits pequenos (Conventional Commits). Não altere nada fora do escopo da fase sem avisar.
7. Antes de dizer que terminou, rode pnpm check (e pnpm e2e quando a fase tiver E2E) e corrija o que falhar.
8. Ao terminar, responda com: (a) o que foi feito, por arquivo; (b) o que ficou pendente e por quê; (c) como testar manualmente; (d) quais itens ⚠️ você confirmou, com a evidência, e quais continuam abertos.
```

## 15.1 Fase 0 — Fundação

```text
Fase 0 — Fundação. Siga as REGRAS COMUNS de docs/15-prompts-por-fase.md §15.0.

Leia antes: docs/00-indice-e-premissas.md; docs/03-arquitetura.md (§3.5, ADR-001 a ADR-004, ADR-012); docs/09-ui-ux.md (§9.10 e §9.14); docs/13-setup-deploy.md (§13.2, §13.5, §13.6, §13.7).

Objetivo: repositório pronto com ferramentas, CI e deploy vazio. Nenhuma funcionalidade de produto ainda.

Faça:
1. Vite + React + TypeScript strict; Tailwind CSS v4 com @tailwindcss/vite e o CSS de tema de docs/09 §9.10; Biome; aliases @/, @shared/ e @server/ (tsconfig e vite).
2. Estrutura de pastas de docs/09 §9.14, com placeholders mínimos.
3. server/lib/env.ts com Zod cobrindo TODAS as variáveis de docs/13 §13.2 (as obrigatórias impedem a subida) e .env.example comentado.
4. server/app.ts (Hono) com GET /api/health; api/[[...route]].ts como adaptador da Vercel (confirme na documentação atual da Vercel e do Hono a forma recomendada para projeto Vite com funções em api/); scripts/dev-server.ts com @hono/node-server; proxy /api no Vite; pnpm dev sobe os dois.
5. Drizzle: drizzle.config.ts; server/db/client.ts usando o driver do Neon em produção e PGlite quando DATABASE_URL=pglite://memory; migração inicial vazia; scripts db:generate e db:migrate.
6. Vitest (com cobertura) e Playwright (projetos Chromium "Pixel 7" e WebKit "iPhone 14"), cada um com um teste trivial.
7. .github/workflows/ci.yml conforme docs/13 §13.7 (o passo de E2E pode ficar comentado até existir tela).
8. vercel.json de docs/13 §13.5, com um script de build que substitui o hash da CSP.
9. CLAUDE.md na raiz com as REGRAS COMUNS e o mapa de docs/ (uma linha por arquivo).
10. Script check-bundle que falha o build se encontrar padrões de segredo em dist/ (por exemplo, sk-ant-, tokens JWT ou valores das variáveis do servidor).

Fora do escopo: TMDB, OpenSubtitles, LLM e telas.

Critérios de aceite: pnpm check verde; pnpm dev abre a página "Segunda Tela" e /api/health responde {"status":"ok"}; pnpm build passa no check-bundle; CI verde.
No final, liste o passo a passo para eu configurar Vercel, Neon e variáveis (docs/13 §13.3).
```

## 15.2 Fase 1 — Tracer bullet (série fixa)

```text
Fase 1 — Tracer bullet com série fixa. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/10-plano-execucao.md (F1); docs/04-integracoes.md (§4.1.2, §4.2.1–§4.2.4, §4.2.8, §4.2.12, §4.3.1–§4.3.2); docs/05-modelo-de-dados.md (§5.3: apenas episodes, quizzes e generation_jobs; §5.5); docs/06-contrato-api.md (§6.4: GET/POST do quiz e GET do job); docs/07-pipeline-legendas.md (§7.3, §7.5, §7.7, §7.9, §7.10, §7.12); docs/08-geracao-quiz.md (§8.2–§8.6).

Objetivo: gerar e exibir um quiz real para UM episódio fixo (TRACER_SERIES_ID, TRACER_SEASON, TRACER_EPISODE), ponta a ponta, usando a arquitetura final em versão mínima.

Faça, nesta ordem e em commits separados:
1. scripts/os-probe.ts: descobre o ID da série pela busca da TMDB, roda as consultas E1–E5 de §4.2.4 e salva em tests/fixtures/opensubtitles/ SOMENTE metadados (uploaders anonimizados). O arquivo de legenda, se baixado, vai só para .private/.
2. Clientes mínimos com os timeouts de docs/03 §3.6: TMDB (episódio en-US com external_ids) e OpenSubtitles (login com token em memória, busca pela estratégia 1, POST /download com sub_format "srt", GET do link).
3. Parser mínimo, testes primeiro: D01, D03, D04, D06; SRT tolerante; R01, R02, R06, R07, R10; M01, M07; S01–S05; render de §7.12. Casos: ENC-01, ENC-05, SRT-01, SRT-02, CLN-01, CLN-05, CLN-09, SEG-01, RND-01, RND-02.
4. Geração: prompt de §8.3–§8.4 (sem reparo), schema de §8.6 (Zod + JSON gerado por script), uma chamada por bloco com concorrência 4 via LlmProvider (§4.3.1–§4.3.2: sem temperature, prefill ou tool_choice forçado). Validação: schema + EVIDENCE_LINES_INVALID. Montar o QuizDocument (§5.5) com P01 e P03.
5. Tabelas episodes, quizzes e generation_jobs + migração.
6. Rotas: POST …/quiz (com TRACER_ONLY=true aceita só o episódio fixo; cria job e continua em waitUntil), GET /api/jobs/:id e GET …/quiz.
7. Página /tracer: botão Gerar, progresso por polling usando pollAfterMs e lista de perguntas com "mostrar resposta".
8. Registrar usage e custo (§4.3.6) no quiz; teste do logger que falha se o pipeline logar texto (§7.13).

Fora do escopo: catálogo, rate limit, código de acesso, reparo, validação semântica completa, UI final.

Critérios de aceite (docs/10 F1): no preview, ≥ 3 blocos e ≥ 20 perguntas válidas em ≤ 120 s; a segunda abertura sai do cache sem chamar OpenSubtitles nem LLM (mostre o log); nenhum texto de legenda em banco ou log.
```

## 15.3 Fase 2 — Catálogo

```text
Fase 2 — Catálogo. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/02-requisitos.md (US-01 a US-03); docs/04-integracoes.md (§4.1 inteira); docs/05-modelo-de-dados.md (§5.4: consulta de status da temporada); docs/06-contrato-api.md (§6.2, §6.3 catalog.ts e generation.ts, §6.4 search/season/quiz-status, §6.5); docs/09-ui-ux.md (§9.2, §9.4, §9.5, §9.6, §9.9, §9.13).

Objetivo: busca de séries, página da série com temporadas e lista de episódios, com cache na CDN e status do quiz por episódio.

Faça:
1. Cliente TMDB completo (busca, série com external_ids, temporada pt-BR com fallback en-US, configuração), mappers de §4.1.3 e testes com fixtures (sucesso, 401, 404, 429 com Retry-After, 5xx, timeout).
2. Rotas /api/config, /api/series/search, /api/series/:id, /api/series/:id/seasons/:n com o Cache-Control exato de §6.2, e /api/series/:id/seasons/:n/quiz-status (no-store). Testes de contrato para todas.
3. Front: Providers (TanStack Query, tema, toasts, error boundary), AppShell com BottomNav, cliente src/lib/api.ts que converte Problem em erro tipado, src/lib/queryKeys.ts, TmdbImage com srcset.
4. HomePage (SearchBox com debounce de 300 ms, resultados, "Carregar mais", buscas recentes), SeriesPage (cabeçalho, SeasonPicker, EpisodeList, QuizStatusBadge, NumberingNotice, SpoilerReveal) e EpisodePage com "Abrir quiz" ou "Gerar quiz" (geração ainda pela rota do tracer).
5. Estados de §9.5 para essas telas, com testes de componentes usando MSW.

Fora do escopo: tela do quiz, código de acesso, rate limit.

Critérios de aceite: US-01 a US-03 atendidas (checklists do docs/02); testes de contrato verdes; Lighthouse mobile ≥ 90 em desempenho na Início.
```

## 15.4 Fase 3 — Pipeline de legendas robusto

```text
Fase 3 — Pipeline de legendas robusto. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/07-pipeline-legendas.md (inteiro); docs/04-integracoes.md (§4.2.2–§4.2.10); docs/05-modelo-de-dados.md (§5.3 subtitle_selections e provider_state; §5.4); docs/06-contrato-api.md (§6.4 ordem de checagens do POST, §6.5); docs/03-arquitetura.md (ADR-005, ADR-009, §3.4, §3.6); docs/12-seguranca-conformidade.md (§12.1: SSRF).

Objetivo: qualquer episódio com legenda em inglês gera quiz ou falha com o código certo, sem desperdiçar cota.

Faça, com testes primeiro:
1. Parser completo do item 7: D01–D07, F01–F05, SRT tolerante e VTT, N01–N04, R01–R20 (regex de §7.7), falantes (§7.8), M01–M07, S01–S07, Q01–Q07. Todos os casos de §7.14, golden files e propriedades de §7.15, testes de desempenho. Cobertura do parser ≥ 95%.
2. Resolução de IDs (§4.2.5): cadeia de 5 estratégias, titleMatch com SIM-01..04, registro de numbering_mismatch.
3. Filtros e pontuação (§4.2.6–§4.2.7) com SEL-01..10.
4. Download (§4.2.8): gzip, limite de 2 MB, allowlist de host com https e no máximo 2 redirecionamentos, registro em subtitle_selections, limite de 2 downloads por episódio a cada 24 h.
5. Sessão da OpenSubtitles cifrada (AES-256-GCM) em provider_state, relogin em 401; estado da cota salvo a cada download e falha rápida.
6. withRetry e mapeamento de erros (§4.1.5, §4.2.9), um teste por linha das tabelas.
7. Job: estágios e progresso de §6.6, heartbeat, deadline de 240 s, JOB_STALLED na leitura, episodes.subtitle_status com janela de 24 h.
8. Checagens 5 e 6 do POST (§6.4).

Fora do escopo: prompt final e validação semântica (Fase 4), UI do quiz.

Critérios de aceite (docs/10 F3): todos os casos do item 7 verdes; rodada manual em 10 episódios variados, incluindo um caso de numeração divergente, com ≥ 9 gerando quiz ou falhando com o código correto (mostre a tabela de resultados); média ≤ 1,2 downloads por quiz pronto.
```

## 15.5 Fase 4 — Qualidade do quiz e avaliação

```text
Fase 4 — Qualidade do quiz e avaliação. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/08-geracao-quiz.md (inteiro); docs/11-testes-avaliacao.md (§11.2 itens 3 e 4, §11.6); docs/05-modelo-de-dados.md (§5.5); docs/03-arquitetura.md (ADR-007, ADR-008); docs/04-integracoes.md (§4.3).

Objetivo: prompt final, validações completas e qualidade medida; decidir o modelo padrão (decisão A1).

Faça:
1. server/domain/quiz/: slotPlan.ts (tabela de §8.2), prompt.ts (textos exatos de §8.3–§8.5 e PROMPT_VERSION), validate.ts e evidence.ts (todos os códigos de §8.7, um teste positivo e um negativo por código), postprocess.ts (P01–P07), generateQuiz.ts (§8.1, política de retry de §8.7).
2. scripts/gen-llm-schema.ts + teste de snapshot + "lint" do schema (§8.6); os exemplos de §8.12 viram fixtures e validam no Zod e no JSON Schema (Ajv só em teste).
3. Embaralhamento determinístico testado (mesma semente → mesma ordem; distribuição ~25% por letra em 1.000 sorteios).
4. Harness pnpm eval (scripts/eval/): episódios de §11.6, cache local em eval/.cache/, matriz de configurações (--configs), métricas automáticas de §11.6, exportação da amostra de 20 perguntas por episódio para revisão e relatório agregado em eval/reports/ (sem citações).
5. Juiz automático opcional atrás de uma flag, com o prompt da rubrica de §11.6.
6. Rodar a matriz sonnet-medium, sonnet-low e haiku-medium, me entregar as amostras para revisão humana e, com as notas, propor a decisão A1 seguindo a regra de §11.6 e atualizar o ADR-007.

Fora do escopo: UI.

Critérios de aceite (docs/10 F4): relatório commitado; na configuração escolhida, ≥ 90% aceitáveis e 0 erros críticos; custo e latência dentro de NFR-03 e NFR-04.
```

## 15.6 Fase 5 — Experiência do quiz

```text
Fase 5 — Experiência do quiz. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/02-requisitos.md (US-09 a US-15); docs/09-ui-ux.md (§9.3–§9.12); docs/05-modelo-de-dados.md (§5.6); docs/06-contrato-api.md (§6.6); docs/11-testes-avaliacao.md (§11.5: E2E-02, E2E-05 a E2E-10, E2E-12).

Objetivo: responder bloco a bloco sem spoiler, com feedback, placar, histórico e configurações, no celular, com acessibilidade.

Faça:
1. Stores locais de §5.6 (Zustand persist) com version, migrate e backup de dados corrompidos; useActiveJobs; testes de migração.
2. features/quiz-session/: selectQuestions (nível, vizinhos, fallback de §9.6) e scoring como funções puras com testes; useQuizSession.
3. QuizLayout e QuizPage: SegmentGate, QuestionCard, OptionList como radiogroup, Pular e Confirmar, atalhos de teclado (§9.8).
4. FeedbackPanel: banner com ícone e texto, explicação EN/PT com preferência salva, evidência só depois da resposta.
5. SegmentSummary com "Já assisti até ≈…" e "Liberar tudo"; desbloqueio salvo na tentativa; respostas salvas a cada interação.
6. ResultPage, HistoryPage (filtro e retomar), SettingsPage (§2 US-14).
7. JobWatcher global com toast "Quiz pronto" (§9.7).
8. Modo sem spoiler completo (§9.9), tema com script anti-flash (§9.10), useWakeLock, vibração opcional.
9. Acessibilidade de §9.11 e textos de §9.12 em src/strings/pt-BR.ts.
10. E2E listados acima em Chromium e WebKit, com axe.

Fora do escopo: código de acesso, rate limit, página Sobre.

Critérios de aceite (docs/10 F5): US-09 a US-15 atendidas; axe sem violações sérias ou críticas; E2E verde nos dois motores; retomar tentativa após fechar a aba funciona.
```

## 15.7 Fase 6 — Endurecimento e lançamento

```text
Fase 6 — Endurecimento e lançamento. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/03-arquitetura.md (ADR-006, ADR-010); docs/06-contrato-api.md (§6.1, §6.4 checagens 1–3 e 7–9, access/verify, admin/maintenance, §6.5, §6.8); docs/05-modelo-de-dados.md (§5.7, §5.10); docs/12-seguranca-conformidade.md (inteiro); docs/13-setup-deploy.md (§13.5, §13.7, §13.8, §13.10); docs/04-integracoes.md (§4.1.7).

Objetivo: segurança, limites e conformidade prontos; MVP em produção.

Faça:
1. Código de acesso: middleware com comparação em tempo constante, POST /api/access/verify, AccessCodeDialog e armazenamento local; bucket access-code-fail:ip.
2. Middleware de rate limit (SQL de §5.4) com todos os buckets de ADR-006 e cabeçalhos X-RateLimit-* e Retry-After; tetos diários de gerações e US$ (§4.3.6).
3. Checagem de Origin; cabeçalhos e CSP de §12.2 (com o hash do script de tema gerado no build e conferido por teste).
4. Logger estruturado com redação de Authorization, Api-Key e X-Access-Code.
5. Autenticação de admin; POST /api/admin/maintenance (renovação aos 150 dias e anulação aos 170 de §5.7, expurgos de §5.10) e o workflow scheduled.yml de §13.7 (maintenance e health).
6. AboutPage: logo aprovado da TMDB menos proeminente que a marca, o aviso exato de §4.1.7, crédito OpenSubtitles, aviso de IA, resumo de privacidade (§12.3) e contato para remoção.
7. Mensagens de erro de §6.5 ligadas na UI; POST /api/admin/quizzes/:id/withdraw.
8. Suíte E2E completa de §11.5 e Lighthouse CI no PR.
9. Me entregue uma lista para eu executar: variáveis de produção, deploy, smoke test e o checklist de §12.6 marcado com o que você conseguiu verificar.

Fora do escopo: extras MVP+ (upload, relatos, pré-geração, painel).

Critérios de aceite (docs/10 F6): testes de §6.8 verdes; checklist de §12.6 completo; manutenção agendada executada com sucesso uma vez.
```

## 15.8 Fase 7 — Extras MVP+

```text
Fase 7 — Extras MVP+. Siga as REGRAS COMUNS (§15.0).

Leia antes: docs/02-requisitos.md (US-07, US-10 item de relato, US-13 exportar/importar, US-17, US-18); docs/06-contrato-api.md (§6.4: upload, reports e admin pregen/stats); docs/05-modelo-de-dados.md (§5.3 question_reports e pregen_queue; §5.6 exportação); docs/04-integracoes.md (§4.2.10 reserva interativa); docs/13-setup-deploy.md (§13.7 job pregen); docs/12-seguranca-conformidade.md (§12.1 upload malicioso).

Objetivo: upload manual, relatos de pergunta, pré-geração em lote, painel de uso e exportar/importar histórico, cada um atrás de sua flag.

Faça:
1. POST …/quiz/upload (multipart, 1 MB, confirmRights, bytes só em memória até o waitUntil) + UI na GenerationError; testes de 413, 415 e 400.
2. POST /api/quizzes/:quizId/questions/:questionId/reports com bucket report:device + ReportButton no FeedbackPanel (aviso "Não inclua dados pessoais").
3. Pré-geração: pregen_queue, POST /api/admin/pregen (enfileira temporada), POST /api/admin/pregen/run (processa um item, respeitando reserva e orçamento) e o job pregen do scheduled.yml.
4. GET /api/admin/stats (§6.4) a partir de usage_daily, generation_jobs e provider_state.
5. Exportar e importar histórico em JSON (§5.6), sem deviceId e sem código de acesso, com validação Zod na importação.

Critérios de aceite (docs/10 F7): US-07, US-17 e US-18 atendidas; teste com cota simulada prova que a pré-geração nunca usa a reserva; importação rejeita arquivo inválido sem apagar o histórico atual.
```
