# 2. Requisitos

Formato: cada história tem ID, prioridade e critérios de aceite em checklist. Uma história só é "pronta" quando todos os itens estão marcados e cobertos por teste (unitário, contrato ou E2E; ver item 11).

## 2.1 Épico A — Catálogo

### US-01 Buscar série · [MVP]
**Como** estudante, **quero** buscar uma série pelo nome **para** achar o episódio que vou assistir.

- [ ] A busca dispara com ≥ 2 caracteres, com debounce de 300 ms; Enter busca na hora.
- [ ] Cada resultado mostra pôster (placeholder se não houver), nome em PT-BR, nome original quando diferente e ano de estreia.
- [ ] Paginação com "Carregar mais" (20 por página, como a TMDB devolve).
- [ ] Vazio: "Nenhuma série encontrada para "{termo}"". Erro: mensagem e botão "Tentar de novo".
- [ ] Série com idioma original diferente de `en` exibe o selo "Áudio original não é inglês" (premissa P2).
- [ ] As 8 buscas mais recentes ficam salvas no aparelho e aparecem na tela inicial.

### US-02 Ver a série e escolher a temporada · [MVP]
- [ ] Cabeçalho com pôster, nome, anos de exibição e número de temporadas; sinopse da série obedece ao modo sem spoiler.
- [ ] Seletor de temporadas em chips roláveis; "Especiais" (temporada 0) aparece por último.
- [ ] Abre na última temporada em que você respondeu algo; senão, na temporada 1.
- [ ] A URL reflete a temporada (`/series/:seriesId/season/:seasonNumber`), então voltar e compartilhar funcionam.

### US-03 Ver os episódios da temporada · [MVP]
- [ ] Cada item mostra still 16:9 (carregamento preguiçoso), número ("E04"), título, sinopse (2 linhas, com "mais"), duração ("22 min") e data (dd/mm/aaaa).
- [ ] Selo de status: "Pronto", "Gerando…", "Sem quiz", "Sem legenda" (falha nas últimas 24 h), "Respondido 8/10".
- [ ] No modo sem spoiler, sinopse e still ficam ocultos com "Toque para revelar" (por episódio).
- [ ] Aviso fixo e discreto: "A numeração pode variar entre serviços de streaming — confira pelo título."
- [ ] Sinopse sem tradução em PT-BR cai para inglês, com selo "EN".
- [ ] O status do quiz atualiza sem recarregar a página quando um job termina.

## 2.2 Épico B — Geração do quiz

### US-04 Gerar o quiz de um episódio · [MVP]
- [ ] Se já existe quiz pronto, ele abre sem chamar a IA, em ≤ 1,5 s (p95, 4G).
- [ ] Se não existe, aparece "Gerar quiz"; na primeira vez o app pede o código de acesso e o guarda no aparelho.
- [ ] O progresso mostra as etapas: "Procurando legenda → Baixando → Limpando o texto → Criando perguntas (3/5 blocos) → Conferindo".
- [ ] Posso sair da tela ou bloquear o celular; ao voltar, o progresso continua de onde está e o quiz abre quando ficar pronto.
- [ ] Dois pedidos simultâneos do mesmo episódio (de qualquer usuário) resultam em um único job.
- [ ] Falha mostra mensagem específica por causa (sem legenda, cota, IA indisponível, limite de uso) e a ação possível.

### US-05 Legenda não encontrada · [MVP]
- [ ] Mensagem: "Não achamos legenda em inglês para este episódio", com as ações "Enviar arquivo .srt/.vtt" ([MVP+]) e "Tentar de novo mais tarde".
- [ ] O episódio fica marcado "Sem legenda" por 24 h, para não repetir buscas; existe "Buscar de novo" para forçar.

### US-06 Cota diária de legendas esgotada · [MVP]
- [ ] Mensagem com o horário local de renovação, por exemplo: "A cota diária de legendas acabou. Renova hoje às 21:00."
- [ ] Quizzes já gerados continuam funcionando normalmente.
- [ ] Enquanto a cota conhecida for zero, o backend falha rápido, sem chamar a OpenSubtitles.

### US-07 Enviar a minha legenda · [MVP+]
- [ ] Aceita `.srt` e `.vtt` de até 1 MB, em UTF-8, UTF-16 ou Windows-1252.
- [ ] Exige código de acesso e a confirmação "Tenho direito de usar este arquivo".
- [ ] O arquivo é processado em memória e descartado; o quiz registra "fonte: arquivo enviado".
- [ ] Passa pelas mesmas checagens de qualidade da legenda baixada; se a duração não bater com o episódio, o erro diz isso.

### US-08 Código de acesso · [MVP]
- [ ] Sem código válido, o app funciona em modo leitura (quizzes prontos); "Gerar" pede o código.
- [ ] Código errado mostra "Código inválido" sem dar pistas; 5 erros por hora por IP bloqueiam novas tentativas por 1 h.

## 2.3 Épico C — Quiz

### US-09 Responder por blocos, em ordem · [MVP]
- [ ] O quiz mostra "Bloco 1 · 00:00–05:12" com as perguntas do meu nível, em ordem cronológica (pela primeira linha de evidência).
- [ ] O bloco seguinte fica bloqueado até eu tocar "Já assisti até ≈05:12"; existe "Liberar tudo (já assisti o episódio)".
- [ ] Cada pergunta mostra o tipo ("Vocabulário", "Verdadeiro ou falso", "Complete a frase", "Compreensão", "Inferência") e o nível.
- [ ] Posso pular uma pergunta e voltar a ela no fim do bloco.
- [ ] Os horários são aproximados ("≈") porque a legenda pode estar alguns segundos fora do meu streaming.

### US-10 Feedback com explicação · [MVP]
- [ ] Ao confirmar, aparece "Correto"/"Incorreto" com ícone e texto (nunca só cor) e a alternativa certa destacada.
- [ ] A explicação vem em inglês; "Ver em português" alterna para a versão em PT-BR, e a preferência fica salva.
- [ ] A evidência ("≈03:12 — trecho curto") só aparece depois da resposta.
- [ ] [MVP+] "Reportar problema" com as opções: resposta errada, pergunta sobre imagem, spoiler, confusa.

### US-11 Pontuação e revisão · [MVP]
- [ ] Placar por bloco e total (acertos/total e %), também por tipo de pergunta.
- [ ] Revisão das perguntas erradas, com explicação.
- [ ] Refazer o quiz cria uma nova tentativa; as anteriores ficam no histórico.

### US-12 Escolher o nível · [MVP]
- [ ] Níveis A2, B1, B2 e C1, cada um com descrição curta.
- [ ] Opção "Incluir níveis vizinhos (±1)" para quizzes mais longos.
- [ ] Trocar de nível não gera nada de novo (banco multinível, D3) e vale imediatamente.

## 2.4 Épico D — Histórico e configurações

### US-13 Histórico local · [MVP]
- [ ] Lista de tentativas (série, episódio, data, nível, %), mais recentes primeiro; filtro por série.
- [ ] Retomar uma tentativa incompleta no ponto em que parei.
- [ ] [MVP+] Exportar e importar o histórico em JSON.
- [ ] Guarda até 500 tentativas; acima disso, as mais antigas viram resumo (só placar).

### US-14 Configurações · [MVP]
- [ ] Nível; níveis vizinhos; modo sem spoiler (padrão: ligado); tema (sistema/claro/escuro); explicação em PT-BR por padrão; manter a tela ligada durante o quiz; apagar dados locais (com confirmação).

### US-15 Modo sem spoiler · [MVP]
- [ ] Oculta sinopses e stills dos episódios (revelar por toque); títulos continuam visíveis.
- [ ] No quiz, nunca mostra perguntas, evidências ou explicações de blocos ainda bloqueados.

## 2.5 Épico E — Conformidade e operação

### US-16 Sobre e créditos · [MVP]
- [ ] Logo aprovado da TMDB, menos proeminente que a marca do app, com link para themoviedb.org e o aviso obrigatório (§4.1.7).
- [ ] Crédito "Legendas: OpenSubtitles.com" com link e o aviso "As perguntas são geradas por IA e podem conter erros".
- [ ] Resumo de privacidade: o que fica no aparelho e o que fica no servidor.

### US-17 Pré-geração em lote (admin) · [MVP+]
- [ ] Endpoint protegido por `ADMIN_TOKEN` enfileira episódios (por exemplo, uma temporada inteira).
- [ ] Nunca usa os últimos 5 downloads do dia (reserva para uso interativo) e respeita o teto de US$.
- [ ] Roda diariamente via GitHub Actions; o resultado fica no log do job.

### US-18 Painel de uso (admin) · [MVP+]
- [ ] `GET /api/admin/stats` mostra gerações, falhas por código, downloads usados/restantes e tokens/US$ do dia e do mês.

## 2.6 Épico F — Quizzes compartilhados (professor → aluno)

Visão completa, dados, API e telas no item 16. Regra do épico: **nenhuma conta e nenhum dado de professor ou aluno no servidor**; quem só quer responder os quizzes da IA não vê diferença.

### US-19 Montar um quiz para compartilhar · [MVP+]
**Como** professor, **quero** montar um quiz sobre um episódio **para** passar como tarefa aos meus alunos.

- [ ] "Criar quiz para compartilhar" aparece no quiz da IA e na lista de episódios, para qualquer pessoa.
- [ ] Com o quiz da IA pronto, o editor mostra o banco multinível com filtros por nível, tipo e bloco; marco as perguntas que quero e reordeno dentro do bloco.
- [ ] Posso editar enunciado, alternativas, resposta certa e explicações; a pergunta editada ganha o selo "editada pelo professor".
- [ ] Defino título, instruções, liberação dos blocos (progressiva ou tudo liberado), se a explicação aparece após cada resposta e um nível indicativo (§16.4.2).
- [ ] O rascunho fica só no aparelho até eu publicar; fechar o app não o perde.
- [ ] "Ver como aluno" mostra a pré-visualização exatamente como o aluno verá.
- [ ] O editor avisa: o quiz é visível para quem tiver o link, não devo escrever dados pessoais e o uso é sem fins comerciais.

### US-20 Escrever perguntas próprias · [MVP+]
- [ ] Tipos: múltipla escolha (2 a 4 alternativas) e verdadeiro ou falso; resposta certa obrigatória.
- [ ] Cada pergunta própria pede o momento aproximado (`≈mm:ss`), que a põe no bloco certo e na ordem cronológica.
- [ ] Citação do diálogo opcional, com até 15 palavras; explicações em inglês e em português opcionais.
- [ ] Funciona também em episódio sem quiz da IA (modo "do zero"), com blocos calculados pela duração da TMDB.
- [ ] Os limites de §16.4.3 são checados enquanto digito, com mensagem por campo.

### US-21 Publicar e compartilhar por link · [MVP+]
- [ ] "Publicar" pede o código de acesso se o aparelho ainda não tiver um (decisão A8).
- [ ] Recebo o link do aluno (`/q/{código}`) com "Copiar" e "Compartilhar", e o link de edição com o aviso "Guarde este link: é o único jeito de editar em outro aparelho".
- [ ] O servidor não pede nem guarda nome, e-mail, IP ou identificador do aparelho; guarda só o quiz e o hash do link de edição.
- [ ] Documento inválido volta com a lista de campos a corrigir, e o rascunho não se perde.

### US-22 Responder um quiz compartilhado · [MVP+]
**Como** aluno, **quero** abrir o link do professor e responder **sem criar conta**.

- [ ] O link abre direto o quiz, sem login, sem código e sem configurar nada; o cabeçalho mostra título, instruções, série e episódio.
- [ ] A experiência é a mesma do quiz da IA (US-09, US-10): blocos, liberação conforme a escolha do professor, feedback e evidência só depois da resposta; não há seletor de nível.
- [ ] A tentativa fica no histórico local com o selo "Compartilhado"; nada é enviado ao servidor.
- [ ] Se o professor publicar uma versão nova no meio da tentativa, termino na versão em que comecei; ao reabrir, vejo o aviso e a opção de recomeçar (§16.11).
- [ ] Quiz despublicado, apagado ou expirado mostra "Este quiz não está mais disponível".

### US-23 Gerenciar meus quizzes compartilhados · [MVP+]
- [ ] "Meus quizzes" lista os quizzes publicados neste aparelho, com versão e data de expiração, e destaca os que vencem em até 15 dias.
- [ ] Ações: editar (publica uma versão nova), renovar por mais 150 dias, despublicar e publicar de novo, gerar novo link de edição e apagar (com confirmação).
- [ ] Abrir o link de edição em outro aparelho permite editar e acrescenta o quiz à lista daquele aparelho.
- [ ] Edição simultânea em dois aparelhos não sobrescreve em silêncio: o segundo vê "Este quiz mudou; recarregue".
- [ ] Exportar o histórico (US-13) só inclui os links de edição se eu marcar essa opção.

### US-24 Enviar o resultado ao professor · [MVP+]
- [ ] No fim de um quiz compartilhado, "Enviar resultado ao professor" gera um texto com título, código, versão, acertos (total e por bloco) e os números das perguntas erradas (§16.10).
- [ ] O nome é opcional, digitado na hora e lembrado só no aparelho.
- [ ] Abre o compartilhamento nativo do celular; sem suporte, copia para a área de transferência.
- [ ] Nada desse resultado passa pelo servidor.

## 2.7 Rastreabilidade

| História | Fase (item 10) | Endpoint (item 6) | Tela (item 9) |
|---|---|---|---|
| US-01..03 | Fase 2 (Catálogo) | `/api/series/*` | Busca, Série |
| US-04..06 | Fases 1 (tracer) e 3 (pipeline robusto) | `POST /api/episodes/…/quiz`, `/api/jobs/:id`, `/api/quota` | Episódio, Geração |
| US-07 | Fase 7 (extras MVP+) | `POST /api/episodes/…/quiz/upload` | Geração |
| US-08 | Fase 6 (endurecimento) | cabeçalho `X-Access-Code` | Geração |
| US-09..12 | Fases 1 e 5 (experiência do quiz) | `GET /api/episodes/…/quiz` | Quiz, Resultado |
| US-13..15 | Fase 5 | — (local) | Histórico, Configurações |
| US-16 | Fase 6 | — | Sobre |
| US-17..18 | Fase 7 | `/api/admin/*` | — |
| US-19..21 | Fase 8 (quizzes compartilhados) | `POST /api/shared-quizzes` | Editor, Publicado |
| US-22, US-24 | Fase 8 | `GET /api/shared-quizzes/:shareCode` | Quiz do aluno |
| US-23 | Fase 8 | `PUT`, `PATCH` e `DELETE /api/shared-quizzes/:shareCode`, `…/renew`, `…/rotate-token` | Meus quizzes, Edição |

Fases (detalhadas no item 10): 0 Fundação · 1 Tracer bullet (série fixa) · 2 Catálogo · 3 Pipeline de legendas robusto · 4 Qualidade do quiz e avaliação · 5 Experiência do quiz · 6 Endurecimento e lançamento · 7 Extras MVP+ · 8 Quizzes compartilhados (item 16).

## 2.8 Requisitos não funcionais

| ID | Categoria | Requisito | Como verificar |
|---|---|---|---|
| NFR-01 | Desempenho | Quiz em cache: TTFB p95 < 300 ms no servidor; 1ª pergunta visível < 1,5 s em 4G | Logs do servidor + Lighthouse |
| NFR-02 | Desempenho | LCP < 2,5 s; JS inicial < 200 KB gzip | Lighthouse CI no PR |
| NFR-03 | Geração | p95 ≤ 90 s (22 min) e ≤ 150 s (45 min); deadline duro do job: 240 s | Métricas do job |
| NFR-04 | Custo | Teto de LLM US$ 1/dia (corte automático); ≤ 2 downloads por episódio por 24 h | `usage_daily`, `subtitle_selections` |
| NFR-05 | Segurança | Nenhum segredo no bundle do front; CSP restritiva; toda entrada validada com Zod | Checagem no build + testes de contrato |
| NFR-06 | Abuso | Rate limit por IP e por dispositivo; código de acesso para gerar | Testes de contrato |
| NFR-07 | Privacidade | Nenhuma PII; IP só como hash com sal; logs retidos por ≤ 30 dias; quizzes compartilhados sem autor, aluno, IP ou respostas no servidor | Revisão de código e de logs; teste que lista as colunas de `shared_quizzes` |
| NFR-08 | Conformidade | Texto bruto de legenda nunca persistido nem logado; citações ≤ 15 palavras; dados da TMDB ≤ 6 meses; atribuição presente | Testes automatizados + revisão |
| NFR-09 | Acessibilidade | WCAG 2.2 AA; alvos de toque ≥ 44 px; `lang="en"` no conteúdo em inglês | axe-core no Playwright |
| NFR-10 | Compatibilidade | Safari iOS ≥ 16.4, Chrome Android recente, Chrome/Firefox desktop | E2E em WebKit e Chromium |
| NFR-11 | Resiliência | Falha de upstream não derruba o app: catálogo vem da CDN, quizzes prontos continuam | Testes com mocks de falha |
| NFR-12 | Qualidade do quiz | ≥ 90% de perguntas aceitáveis; 100% com evidência válida; 0 visuais; 0 spoilers | Eval (item 11) |
| NFR-13 | Manutenibilidade | TypeScript `strict`; contratos em `shared/` (Zod); cobertura do parser ≥ 95% das linhas | CI |
| NFR-14 | Observabilidade | Logs JSON com `requestId` e `jobId`; tempo por estágio; erro de upstream identificável | Revisão de logs |
| NFR-15 | Portabilidade | Só um arquivo de adaptação conhece a Vercel; o resto do backend roda em Node puro | Revisão de código |
| NFR-16 | Segurança | Link de edição com 256 bits aleatórios; o servidor guarda só o SHA-256; o token viaja no fragmento da URL e no cabeçalho `Authorization`, nunca em query string nem em log | Testes de contrato + teste que procura o token nos logs |
| NFR-17 | Segurança | Texto escrito por professores é exibido só como texto puro (sem HTML, Markdown ou links clicáveis) | Teste de componente com conteúdo malicioso |
