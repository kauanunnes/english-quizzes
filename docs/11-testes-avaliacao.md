# 11. Estratégia de testes e avaliação do quiz

## 11.1 Pirâmide

| Camada | Ferramenta | Alvo principal | Onde roda | Quando |
|---|---|---|---|---|
| Unidade | Vitest (+ fast-check) | **parser** (item 7), seleção, `titleMatch`, query builder, retry, custo, validadores (§8.7), pós-processamento, seleção de perguntas, migrações locais | CI | todo PR |
| Contrato | Vitest + `app.request()` + MSW | rotas (§6.8) e clientes TMDB/OpenSubtitles/LLM contra respostas gravadas | CI | todo PR |
| Integração | Vitest + PGlite | ciclo do job, idempotência, travamento, rate limit, orçamento, cota | CI | todo PR |
| Componentes | Vitest + Testing Library + MSW | estados das telas (§9.5), quiz | CI | todo PR |
| E2E | Playwright (Chromium "Pixel 7" e WebKit "iPhone 14") + axe-core | fluxos de §11.5 com backend real em modo teste | CI | todo PR |
| Smoke | Playwright | catálogo e um quiz já gerado no preview/produção, **sem gerar** | agendado | diário |
| Avaliação | `pnpm eval` | qualidade das perguntas (§11.6) | máquina local | mudança de prompt, validador ou modelo |

Metas de cobertura: parser ≥ 95% das linhas; `server/domain` ≥ 85%; global ≥ 75%. A cobertura do parser bloqueia o CI.

## 11.2 Unidade (prioridades)
1. Parser: todos os IDs de §7.14 como nomes de teste (`it('CLN-05: remove descrição entre colchetes')`), golden files e propriedades de §7.15.
2. Seleção de legenda: SEL-01..10 e SIM-01..04.
3. Validadores: um caso positivo e um negativo por código de §8.7.
4. Pós-processamento: embaralhamento determinístico (mesma semente → mesma ordem), ordenação, orçamento de citação, deduplicação.
5. `buildSubtitleQuery`, `withRetry` (respeita `Retry-After` e deadline), `costUsd`, `scoreCandidate`.
6. Front: `selectQuestions`, `scoring`, migrações das stores.

## 11.3 Contrato
- Fixtures gravadas na Fase 1 (`tests/fixtures/tmdb`, `tests/fixtures/opensubtitles`), só metadados; nomes de uploader anonimizados.
- Para cada cliente: sucesso, 401, 404, 406 (cota), 429 com `Retry-After`, 5xx, timeout, corpo inesperado (validação com Zod falha de forma controlada).
- Para cada rota: os itens de §6.8.
- Verificação de deriva (opcional, semanal): script que chama **só endpoints de leitura** reais (busca TMDB e `/subtitles`, nunca `/download`) e compara o formato com as fixtures; abre issue se mudar.

## 11.4 Integração (PGlite)
- [ ] Job feliz: `queued → … → ready`, com quiz gravado e `usage_daily` incrementado.
- [ ] Dois `POST` simultâneos → um job.
- [ ] `heartbeat_at` velho → `JOB_STALLED`; novo `POST` cria outro job.
- [ ] Cota conhecida zerada → `503` sem chamar o cliente da OpenSubtitles (mock verifica zero chamadas).
- [ ] Orçamento estourado no meio do job → `BUDGET_EXCEEDED`, gasto parcial registrado.
- [ ] 1º candidato reprovado no QA → 2º baixado; 3º nunca (limite por episódio).
- [ ] Contadores de rate limit por janela e expurgo.
- [ ] Renovação/anulação dos metadados da TMDB aos 150/170 dias (relógio simulado).

## 11.5 E2E (Playwright)
Ambiente: `scripts/dev-server.ts` com `MOCK_UPSTREAMS=1` (MSW interceptando TMDB e OpenSubtitles no processo do servidor), `LLM_PROVIDER=fake` e banco PGlite em memória. Nada externo no CI.

| ID | Fluxo |
|---|---|
| E2E-01 | Buscar série → temporada → episódio → gerar → progresso → quiz |
| E2E-02 | Episódio com quiz pronto abre direto, sem progresso |
| E2E-03 | Sem legenda → mensagem e ação de upload (se ligado) |
| E2E-04 | Cota esgotada → horário de renovação em hora local; botão desabilitado |
| E2E-05 | Recarregar a página durante a geração → progresso retoma; toast ao terminar |
| E2E-06 | Quiz: bloco 2 bloqueado até "Já assisti até…"; "Liberar tudo" funciona |
| E2E-07 | Feedback: evidência só depois de responder; alternância EN/PT persiste |
| E2E-08 | Modo sem spoiler: sinopse e still ocultos até tocar |
| E2E-09 | Tema escuro persiste após recarregar, sem flash (checagem da classe antes do primeiro paint) |
| E2E-10 | Histórico: retomar tentativa incompleta no ponto certo |
| E2E-11 | Código de acesso: inválido → mensagem; válido → gera |
| E2E-12 | axe-core em todas as telas: 0 violações sérias/críticas |

## 11.6 Avaliação da qualidade do quiz

### Conjunto de referência (5 episódios)
Escolhidos para cobrir estilos diferentes de diálogo:

| # | Episódio | Por quê |
|---|---|---|
| 1 | Victorious S01E01 | sitcom adolescente, falas rápidas, números musicais (testa R10 e Q05) |
| 2 | Friends S01E01 | sitcom clássica, muitas expressões idiomáticas |
| 3 | The Office (EUA) S02E01 | ironia e sarcasmo, depoimentos para a câmera (testa inferência) |
| 4 | Ted Lasso S01E01 | inglês britânico e americano misturados, gírias |
| 5 | Breaking Bad S01E01 | drama de ~58 min, vocabulário técnico (testa muitos blocos e custo) |

Os IDs da TMDB ficam em `scripts/eval/episodes.json` (descobertos pelo próprio script). Troque um episódio se a legenda não existir.

### Execução
- `pnpm eval --configs sonnet-medium,sonnet-low,haiku-medium` baixa cada legenda **uma vez** e guarda o arquivo em `eval/.cache/` (no `.gitignore`, só na sua máquina; `pnpm eval:clean` apaga). Isso é exceção restrita ao desenvolvimento local, para não gastar 5 downloads por rodada; nada disso vai para o deploy.
- Para cada configuração: gera os quizzes com o pipeline real, grava as perguntas em `eval/.cache/results/` e um relatório agregado em `eval/reports/<data>-<config>.md` (este sim commitado, sem citações).

### Métricas automáticas

| Métrica | Meta |
|---|---|
| Saídas válidas no schema | 100% |
| Taxa de preenchimento de slots (válidas ÷ 8 por bloco) | ≥ 85% |
| Reprovação nos validadores (antes do reparo) | ≤ 15% |
| Blocos que precisaram de reparo | ≤ 20% |
| Distribuição de tipos e níveis | cada tipo ≥ 10% do total; níveis equilibrados |
| Posição da resposta correta após P02 | ~25% em cada letra (questões de 4 opções) |
| `LENGTH_BIAS` | ≤ 15% das questões |
| Razão de citação | ≤ 15% |
| Custo por episódio e latência p50/p95 | dentro de NFR-03/NFR-04 |

### Rubrica humana (por pergunta)

| Critério | 0 | 1 | 2 |
|---|---|---|---|
| Correção | resposta errada | discutível | certa |
| Ancoragem | não dá para responder pelo diálogo | precisa de algo fora das linhas citadas | respondível pelas linhas citadas |
| Unicidade | mais de uma correta | uma é quase correta | exatamente uma |
| Distratores | absurdos ou óbvios | um fraco | todos plausíveis e errados |
| Nível | muito fora | ±1 nível | adequado |
| Clareza | confusa | aceitável | clara (inclui a explicação em PT-BR) |

**Erros críticos** (qualquer um reprova a pergunta): resposta errada, pergunta visual, spoiler, fato ou nome inventado, conteúdo inadequado.

**Pergunta aceitável:** sem erro crítico, Correção = 2, Ancoragem = 2 e total ≥ 9/12. **Nota do episódio:** média do total ÷ 12 × 5 (meta ≥ 4,2; §1.6).

### Processo de revisão
1. Amostra de 20 perguntas por episódio (estratificada por nível e tipo) = 100 perguntas por configuração; ~1 hora de revisão sua.
2. Juiz automático opcional: um modelo mais forte (por exemplo, Claude Opus 5.5) recebe as linhas do bloco, a pergunta e a rubrica e pontua todas as perguntas. Calibrar contra as 100 revisadas à mão: concordância ≥ 80% em "aceitável" para usá-lo em comparações. Sendo da mesma família de modelos, ele pode ter vieses parecidos com os do gerador: a revisão humana continua sendo a referência.
3. Decisão A1: escolher a configuração **mais barata** com taxa de aceitáveis ≥ 95% da melhor e **zero** erros críticos; empate → menor latência. Registrar no ADR-007.
4. Regressão: PR que mexe em prompt, validadores ou modelo precisa de relatório anexado; bloqueia se a taxa de aceitáveis cair mais de 3 pontos percentuais ou surgir erro crítico.

## 11.7 Qualidade em produção
- Painel admin: perguntas descartadas por regra, blocos reparados, blocos vazios e relatos por quiz.
- Gatilhos: relatos > 2% das perguntas exibidas em 2 semanas, ou um tipo de pergunta com o dobro da média de relatos → revisar prompt ou validador daquele tipo.
- A cada mês, revisar 20 perguntas aleatórias de quizzes reais com a mesma rubrica.
