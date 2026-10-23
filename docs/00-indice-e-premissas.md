# Segunda Tela — Documentação técnica e plano de implementação

> **Documentação completa** (Partes 1 a 5) · itens 0 (este índice) a 15 · pesquisa das APIs feita em **23/10/2026**
> Nome provisório do produto: **Segunda Tela** (interface em PT-BR). Código, arquivos e endpoints em inglês.

---

## 0.1 Como usar estes documentos

- Coloque todos os arquivos em `docs/` na raiz do repositório. Os prompts por fase (item 15) mandam o assistente de código ler seções no formato `docs/07-pipeline-legendas.md §7.3`.
- Marcações usadas:
  - **✅ verificado**: conferido em fonte oficial em 23/10/2026.
  - **⚠️ A VERIFICAR**: não consegui confirmar; o texto diz onde conferir. Nada marcado assim deve virar constante no código sem checagem.
  - **[MVP]**, **[MVP+]** (opcional dentro do MVP, entra se sobrar fôlego), **[PÓS]** (backlog).
- Toda decisão relevante tem um ADR no item 3. Mudou de ideia? Atualize o ADR antes de mudar o código.

| Arquivo | Item do pedido | Parte | Status |
|---|---|---|---|
| `docs/00-indice-e-premissas.md` | Índice, resumo, "Onde discordo", premissas, fontes | 1 | ✅ entregue |
| `docs/01-visao-geral.md` | 1. Visão geral | 1 | ✅ entregue |
| `docs/02-requisitos.md` | 2. Requisitos funcionais e não funcionais | 1 | ✅ entregue |
| `docs/03-arquitetura.md` | 3. Arquitetura, diagramas e ADRs | 1 | ✅ entregue |
| `docs/04-integracoes.md` | 4. TMDB, OpenSubtitles e LLM | 1 | ✅ entregue |
| `docs/05-modelo-de-dados.md` | 5. Modelo de dados | 2 | ✅ entregue |
| `docs/06-contrato-api.md` | 6. Contrato da API do backend | 2 | ✅ entregue |
| `docs/07-pipeline-legendas.md` | 7. Pipeline de legendas + casos de teste | 2 | ✅ entregue |
| `docs/08-geracao-quiz.md` | 8. Prompt, JSON Schema e exemplos | 3 | ✅ entregue |
| `docs/09-ui-ux.md` | 9. Telas, componentes, estados, pastas | 3 | ✅ entregue |
| `docs/10-plano-execucao.md` | 10. Fases, tarefas, riscos | 4 | ✅ entregue |
| `docs/11-testes-avaliacao.md` | 11. Testes e avaliação do quiz | 4 | ✅ entregue |
| `docs/12-seguranca-conformidade.md` | 12. Segurança, privacidade, termos | 5 | ✅ entregue |
| `docs/13-setup-deploy.md` | 13. Setup, deploy, custos | 5 | ✅ entregue |
| `docs/14-backlog.md` | 14. Backlog pós-MVP | 5 | ✅ entregue |
| `docs/15-prompts-por-fase.md` | 15. Prompts prontos por fase | 5 | ✅ entregue |

---

## 0.2 Resumo executivo

O fluxo em uma frase: o usuário escolhe um episódio no catálogo da TMDB; o backend acha e baixa a legenda em inglês na OpenSubtitles, limpa e divide o texto em blocos de ~5 minutos **só em memória**, pede à LLM perguntas por bloco com evidência verificável, valida tudo por código, guarda **apenas o quiz derivado** e o celular mostra as perguntas bloco a bloco, sem spoiler.

| Tema | Decisão | Onde |
|---|---|---|
| Stack | TypeScript estrito; Next.js 16 (App Router, Cache Components) + React 19 + Tailwind CSS v4 + Zustand; API em route handlers do Next (antes: Vite + Hono, ver tabela de tradução do ADR-014) | ADR-001, ADR-014 |
| Backend e hospedagem | BFF serverless: funções Node.js na Vercel (plano Hobby, uso não comercial) servindo as telas e `/api/*` | ADR-003, ADR-014 |
| Banco | Neon Postgres (plano Free) + Drizzle ORM | ADR-004 |
| Geração assíncrona | Job persistido + `waitUntil` + polling do front; nada de fila externa | ADR-005 |
| Anti-abuso | Código de acesso para gerar + rate limit por IP e dispositivo + tetos diários de gerações e de US$ | ADR-006 |
| LLM | Claude com saída estruturada nativa; padrão inicial `claude-sonnet-5-5` (esforço `medium`); `claude-haiku-5-5` é candidato a padrão se passar na avaliação | ADR-007 |
| Estratégia de geração | 1 chamada por bloco, em paralelo; linhas com IDs (`L042`); banco de perguntas multinível (A2–C1) | ADR-008 |
| Legendas | Conta de usuário OpenSubtitles (20 downloads/24 h na conta grátis); texto bruto nunca persistido nem logado | ADR-009, §4.2 |
| Catálogo | Respostas da TMDB cacheadas na CDN por ≤ 24 h; metadados mínimos no banco renovados antes de 6 meses | ADR-010 |
| Histórico | Local (localStorage versionado) com `deviceId` anônimo, pronto para sincronizar no pós-MVP | ADR-011 |

---

## 0.3 Onde discordo / proponho mudança

| # | Ponto | Seu desenho | Proposta | Por quê |
|---|---|---|---|---|
| D1 | ID do episódio na OpenSubtitles | Enviar o ID do episódio da TMDB | Sua suspeita procede: a documentação recomenda como melhor caminho o ID da **série** (`parent_tmdb_id` ou `parent_imdb_id`) + `season_number` + `episode_number`; o ID do próprio episódio (`tmdb_id` ou `imdb_id`) é alternativa válida, desde que enviado sozinho. Uso uma cadeia de 5 estratégias **com validação do título do episódio** (§4.2.5) | A numeração muda entre bases e serviços. Exemplo real: em Victorious, o S1E4 é "The Birthweek Song" na ordem de exibição (Wikipedia) e "Beck's Big Break" na ordem "HBO Max" da TheTVDB. Sem checar o título, o app baixa a legenda do episódio errado e queima cota |
| D2 | O que vai para a IA | Texto puro, sem timestamps | Texto puro **com IDs de linha** (`L042: …`) e cabeçalho do bloco; timestamps ficam só no backend | O backend confere por código se a citação existe nas linhas citadas (anti-alucinação determinística) e converte ID → timestamp sem gastar tokens |
| D3 | Dificuldade configurável | Gerar o quiz no nível escolhido | Gerar um **banco multinível** (A2, B1, B2, C1; 2 perguntas por nível por bloco) numa única passagem; a UI filtra pelo nível | Sem guardar a legenda e com 20 downloads/dia, gerar outro nível depois exigiria baixar a legenda de novo |
| D4 | Chamada à LLM | Uma chamada com o episódio inteiro | **Uma chamada por bloco de ~5 min**, em paralelo (até 4 simultâneas) | Latência menor (cabe com folga nos 300 s da função), progresso real ("3/5 blocos"), retry só do bloco que falhou e anti-spoiler por construção: a chamada do bloco 3 nunca vê o bloco 5 |
| D5 | Entrega do resultado | Progresso, polling ou streaming (em aberto) | **Job persistido + polling**; streaming só entre backend e LLM | No celular a tela bloqueia e a aba vai para segundo plano; uma conexão de streaming cai, o job continua e o polling retoma quando você volta |
| D6 | Explicação em PT-BR | Opção; "tradução PT-BR" no backlog | Gerar `explanation_pt` **junto**, já no MVP | Custo marginal (centavos por episódio) e nenhum pipeline extra. O item do backlog passa a ser tradução de enunciados/alternativas e glossário |
| D7 | Fallback de legenda | Avaliar outros provedores | Primeiro **upload manual de .srt/.vtt** (processado em memória e descartado); depois SubDL como fallback automático **desligado** até você ler os termos; nada de scraping | O upload resolve qualquer caso sem cota nem termos de terceiros; a maioria das alternativas não tem API oficial |
| D8 | Metadados da TMDB no prompt | Avaliar sinopse e personagens | **Não enviar a sinopse**; enviar só o título da série e do episódio. Lista de personagens: opcional, desligada por padrão | A sinopse traz fatos que não estão no diálogo (a IA "acerta" pela fonte errada) e costuma resumir o fim do episódio. Os nomes dos personagens já aparecem nas falas |
| D9 | Músicas | Remover símbolos ♪ | **Remover as linhas cantadas inteiras** (configurável) | Pergunta sobre letra não mede compreensão de diálogo e reproduziria letra protegida. Pesa em Victorious, que tem números musicais |
| D10 | Proteção da chave de LLM | Rate limit | Rate limit **+ código de acesso para gerar + tetos diários** de gerações e de US$ | É um app pessoal: quem não tem o código só consome quizzes já gerados, que custam zero |
| D11 | Responder enquanto assiste | Ordem cronológica | **Bloqueio por bloco**: o próximo abre quando você toca "Já assisti até ≈05:12"; evidência e explicação só aparecem depois da resposta | Só ordenar não impede de olhar a pergunta seguinte, que pode revelar o que ainda vai acontecer |
| D12 | Histórico local | Guardar no aparelho | Manter, mas com `deviceId` anônimo, formato já pronto para sincronizar e botão de exportar JSON | Evita migração dolorosa quando o login entrar (pós-MVP) e protege contra troca de celular |

---

## 0.4 Premissas

| ID | Premissa | Se for falsa… |
|---|---|---|
| P1 | Uso pessoal e não comercial; até 5 pessoas; até 10 episódios novos por dia | Rever TMDB comercial, plano pago da Vercel e cota da OpenSubtitles (VIP/Pro) |
| P2 | Séries com áudio original em inglês | Em séries de outro idioma, a legenda EN é tradução: o quiz fica sobre a tradução, não sobre o que se ouve |
| P3 | Episódios de 18 a 65 min; temporada 0 (especiais) funciona sem garantia | Filmes ficam fora do MVP |
| P4 | Anime e numeração absoluta ficam fora do MVP | Exigiria grupos de episódios da TMDB |
| P5 | Navegadores-alvo: Safari iOS ≥ 16.4 e Chrome Android recente; desktop é secundário | Wake Lock e alguns recursos degradam com elegância |
| P6 | Conta gratuita da OpenSubtitles no nome do desenvolvedor (20 downloads/24 h) | Com VIP (1.000/dia) nada muda no código, só a variável de ambiente da reserva |
| P7 | Hospedagem nos EUA; ~150 ms de latência a partir do Brasil é aceitável | — |
| P8 | Quizzes são globais: um por episódio, compartilhado entre usuários | Regeneração por usuário multiplicaria custo e cota |
| P9 | Teto de LLM: US$ 1/dia e US$ 10/mês | Ajustável por variável de ambiente |
| P10 | Níveis A2, B1, B2 e C1; padrão B1 | A1 tem pouco a perguntar sobre diálogo nativo; C2 vira curiosidade |
| P11 | Sem login no MVP; o aparelho guarda o histórico | Trocar de celular perde o histórico (mitigado por exportar/importar JSON) |
| P12 | Interface só em PT-BR; conteúdo do quiz em inglês | — |

## 0.5 Decisões em aberto

| ID | Decisão | Opções | Como e quando decidir |
|---|---|---|---|
| A1 | Modelo padrão | Sonnet 5.5 `medium` × Haiku 5.5 `medium` × Sonnet 5.5 `low` | Conjunto de avaliação da Fase 4 (item 11); troca por variável de ambiente |
| A2 | Usar legenda para deficientes auditivos (HI) quando for a única | Usar com limpeza × recusar | Medir no eval; padrão: usar |
| A3 | Nomes de personagens da TMDB no prompt | Sim × não | Depois de ler os termos da TMDB sobre IA (⚠️ §4.1.7) e medir ganho no eval |
| A4 | SubDL como fallback automático | Ligar × manter desligado | Depois de ler os termos da SubDL |
| A5 | Perguntas por nível por bloco | 1, 2 ou 3 | Após duas semanas de uso real |
| A6 | Domínio próprio | `*.vercel.app` × domínio | Opcional, a qualquer momento |
| A7 | Plano da OpenSubtitles | Grátis × VIP | Se a cota estourar mais de 2 vezes por semana |

---

## 0.6 Fontes verificadas e pendências (23/10/2026)

| Tema | O que foi confirmado | Fonte | Status |
|---|---|---|---|
| OpenSubtitles: base | `https://api.opensubtitles.com/api/v1`; cabeçalhos `Api-Key` e `User-Agent` descritivo | opensubtitles.stoplight.io (Getting started) e compilação da doc no fórum oficial | ✅ |
| OpenSubtitles: busca de episódio | Melhor: ID da série (`parent_imdb_id`/`parent_tmdb_id`) + `season_number` + `episode_number`. Alternativa: `imdb_id`/`tmdb_id` do episódio, enviado sozinho | Doc "Search for subtitles" (compilação no fórum oficial) | ✅ |
| OpenSubtitles: filtros | `ai_translated` (padrão include), `machine_translated` (padrão exclude), `hearing_impaired` include/exclude/only (padrão include), `foreign_parts_only`, `trusted_sources`, `type`; campos de `order_by` | Doc "Search for subtitles" | ✅ |
| OpenSubtitles: boas práticas | Parâmetros em ordem alfabética e minúsculos; IMDb sem "tt" e sem zeros à esquerda; não enviar valores padrão; `+` no lugar de `%20`; evitar `order_by` | Doc "Best Practices" | ✅ |
| OpenSubtitles: cota | Sem login: 5 downloads/24 h por IP; conta grátis: 20; VIP: 1.000; busca sem limite de cota | Doc Getting started + Help Center ("About the API") | ✅ |
| OpenSubtitles: planos para apps | Pacotes Pro (cotas dedicadas, sem login do usuário final); preços na página "API subscription prices" | Help Center ("Pro packages") | ⚠️ preços |
| OpenSubtitles: login | `/login` devolve `token` e `base_url` (pode ser `vip-api`); login com limite próprio (~1/s) | Compilação da doc no fórum | ⚠️ validade do token e limites exatos |
| OpenSubtitles: cota esgotada | HTTP 406 com `remaining`, `requests`, `reset_time_utc` | Resposta real publicada em issue (fev/2026) | ✅ formato observado |
| OpenSubtitles: termos | ToS: uso comercial proibido; nenhuma cláusula sobre processamento por LLM encontrada | Help Center ("Terms of Service") | ⚠️ confirmar com o suporte |
| TMDB: autenticação | `Authorization: Bearer <API Read Access Token>` ou `api_key` | developer.themoviedb.org (Authentication › Application) | ✅ |
| TMDB: limites | Teto na faixa de ~40 req/s; respeitar 429 | developer.themoviedb.org (Rate Limiting) | ✅ |
| TMDB: cache | Proibido cachear dados da TMDB por mais de 6 meses | themoviedb.org/api-terms-of-use | ✅ |
| TMDB: atribuição | Logo aprovado e menos proeminente que a marca do app; aviso obrigatório na seção Sobre/Créditos; gratuito só para uso não comercial | developer.themoviedb.org (FAQ) | ✅ |
| TMDB: imagens | `https://image.tmdb.org/t/p/{tamanho}{caminho}`; tamanhos via `/configuration` | developer.themoviedb.org (Image Basics) | ✅ |
| TMDB: IA | Termos do site (vigentes desde 04/06/2026) mencionam treino/validação de IA | Compilação de termos (tostracker) | ⚠️ ler a cláusula nos API Terms |
| Claude: saída estruturada | GA; `output_config.format` com `json_schema`; suporta `claude-sonnet-5-5` e `claude-haiku-5-5`; limitações de JSON Schema | platform.claude.com (Structured outputs) | ✅ |
| Claude Sonnet 5.5 | US$ 2 / US$ 10 por MTok; leitura de cache US$ 0,10; sem `temperature`/`top_p`/`top_k`, sem prefill, sem `tool_choice` forçado; pensamento adaptativo por padrão; `output_config.effort` | platform.claude.com (guia de migração Sonnet 5.5) | ✅ |
| Claude Haiku 5.5 | A partir de US$ 0,10 / US$ 0,50 por MTok (prompts ≤ 100 mil tokens) | Anúncio e páginas que citam a tabela oficial | ⚠️ conferir na página de preços |
| Vercel Functions | Hobby: 300 s de duração máxima; `waitUntil` em `@vercel/functions` | vercel.com/docs/functions/limitations | ✅ (termos de uso não comercial do Hobby: ⚠️) |
| Neon Free | 100 CU-horas/mês e 0,5 GB por projeto; suspende após 5 min ocioso | neon.com/pricing | ✅ |
| Cloudflare Workers Free | 10 ms de CPU por requisição; `waitUntil` estende só 30 s | developers.cloudflare.com (Limits) | ✅ |
| SubDL | API beta: `GET https://api.subdl.com/api/v1/subtitles` com `api_key`, `tmdb_id`, `season_number`, `episode_number`, `languages`; download em `.zip` | subdl.com/api-doc | ✅ (limites e termos: ⚠️) |

**Nota de transparência:** este documento foi escrito por um modelo da Anthropic (Claude) e recomenda Claude como LLM. Por isso a arquitetura isola o provedor atrás de uma interface (§4.3) e o item 11 define um conjunto de avaliação: a escolha final deve sair dos seus números.

---

## 0.7 Glossário

| Termo | Significado |
|---|---|
| Cue | Bloco da legenda original: índice, tempo inicial/final e 1–3 linhas de texto |
| Linha (`L###`) | Unidade de fala após limpeza e junção de cues; tem ID, tempo, texto e, às vezes, falante |
| Bloco (segmento, `S1…Sn`) | Trecho de ~5 min, cortado na maior pausa perto do alvo |
| Banco de perguntas | Todas as perguntas geradas para um episódio, em vários níveis |
| Job | Execução assíncrona da geração, com estágio e progresso |
| Cota | Downloads de legenda permitidos pela OpenSubtitles em 24 h |
| `episodeKey` | Chave do episódio: `tmdb-{seriesId}-s{SS}-e{EE}`, ex.: `tmdb-1234-s01-e04` |

---

**Próximos passos:** (1) ler as seções 0.3 a 0.6 e ajustar o que discordar; (2) criar as contas e chaves (§13.3); (3) começar pela Fase 0 colando o prompt de `docs/15-prompts-por-fase.md` §15.1 no assistente de código; (4) antes do lançamento, escrever ao suporte da OpenSubtitles (§12.4).
