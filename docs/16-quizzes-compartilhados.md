# 16. Quizzes compartilhados (professor → aluno)

> **Extra** pedido em 23/10/2026, depois da Parte 1 · prioridade **[MVP+]**, **Fase 8** · decisão de arquitetura no **ADR-013** (item 3) · histórias **US-19..US-24** (item 2).
> Os itens 5 (modelo de dados), 6 (contrato da API) e 9 (telas), quando escritos, devem incorporar as seções 16.6, 16.7 e 16.9.

---

## 16.1 Objetivo e limites

Uma pessoa (o **professor**) monta um quiz sobre um episódio e manda o link para outras pessoas (os **alunos**), que respondem no celular do mesmo jeito que respondem os quizzes da IA.

Três regras guiam o desenho:

1. **Sem login e sem dados pessoais no servidor.** O servidor guarda só o conteúdo do quiz. Quem criou é reconhecido por um **link de edição secreto**, não por uma conta. Do aluno, o servidor não guarda nada.
2. **Nada muda para quem só quer responder.** Qualquer pessoa continua entrando no site e respondendo os quizzes gerados pela IA, sem login e sem código de acesso.
3. **Custo zero por quiz compartilhado.** Montar e publicar não chama a LLM nem baixa legenda: o professor reaproveita o banco de perguntas da IA (D3) e/ou escreve as próprias.

| Continua igual | Novo |
|---|---|
| Quiz da IA: um por episódio, global (P8), gerado uma vez | Quiz compartilhado: cópia montada por um professor; vários por episódio, cada um com seu link |
| Responder sem login | Responder um quiz compartilhado também sem login e sem código |
| Código de acesso para gerar com IA (US-08) | Código de acesso também para **publicar** um quiz compartilhado (decisão A8) |
| Histórico só no aparelho (ADR-011) | Tentativas de quizzes compartilhados entram no mesmo histórico local, com selo |
| — | Resultado do aluno só sai do aparelho se ele mesmo compartilhar (texto via WhatsApp, e-mail etc.) |

## 16.2 Papéis

| Papel | Quem | O que faz | O que o servidor sabe dele |
|---|---|---|---|
| Professor (criador) | Qualquer pessoa com o código de acesso (A8) | Monta, publica, edita, renova, despublica e apaga | Nada além do conteúdo do quiz e do hash do token de edição |
| Aluno | Qualquer pessoa com o link | Responde, vê feedback e, se quiser, envia o resultado ao professor | Nada: só baixa o quiz |
| Visitante | Qualquer pessoa | Responde os quizzes da IA, como hoje | Nada |

Não existem os conceitos de turma, matrícula ou nota no servidor. Eles ficam para o pós-MVP (16.13), porque exigem guardar dados de usuário.

## 16.3 Fluxo principal

```mermaid
sequenceDiagram
  autonumber
  actor P as Professor
  participant WP as App (celular do professor)
  participant A as API
  participant D as Postgres
  actor S as Aluno
  participant WS as App (celular do aluno)

  P->>WP: No quiz da IA do episódio, toca "Criar quiz para compartilhar"
  WP->>WP: Editor: escolhe/edita perguntas, escreve as próprias (rascunho só no aparelho)
  P->>WP: Toca "Publicar" (pede o código de acesso, se ainda não houver)
  WP->>A: POST /api/shared-quizzes + X-Access-Code {document}
  A->>A: Valida (Zod + regras de 16.4), gera shareCode e editToken
  A->>D: grava documento + SHA-256(editToken) — sem autor, IP ou aparelho
  A-->>WP: 201 {shareCode, editToken, expiresAt}
  WP->>WP: Guarda {shareCode, editToken} em st:shared (só no aparelho)
  WP-->>P: Link do aluno /q/K7M2Q9XA e link de edição /q/K7M2Q9XA/edit#t=…
  P-->>S: Manda o link do aluno (WhatsApp, e-mail, sala de aula)
  S->>WS: Abre /q/K7M2Q9XA
  WS->>A: GET /api/shared-quizzes/K7M2Q9XA
  A-->>WS: 200 documento publicado (cache curto na CDN)
  WS->>WS: Responde por blocos; tentativa salva só no aparelho
  S->>WS: No fim, "Enviar resultado ao professor" (opcional)
  WS-->>P: Texto do resultado pelo canal que o aluno escolher — nada passa pelo servidor
```

## 16.4 Montagem do quiz

### 16.4.1 Duas origens, que podem se misturar

| Origem | Quando | Como funciona |
|---|---|---|
| **A partir do quiz da IA** (recomendado) | O episódio já tem quiz `ready` | O editor mostra o banco multinível inteiro (A2–C1), com filtros por nível, tipo e bloco. O professor marca as perguntas que quer, pode reordenar dentro do bloco e editar enunciado, alternativas, resposta certa e explicações. Pergunta editada ganha o selo "editada pelo professor"; a evidência original (citação + horário) é mantida |
| **Do zero** | O episódio não tem quiz da IA (sem legenda, cota esgotada) ou o professor prefere | O professor escreve cada pergunta e informa o momento aproximado (`≈mm:ss`). Os blocos de ~5 min são calculados pela duração do episódio na TMDB |

Perguntas próprias podem entrar também num quiz montado a partir da IA. O banco de perguntas da IA nunca é alterado: o quiz compartilhado é uma **cópia** (snapshot).

### 16.4.2 Opções do quiz

| Opção | Valores | Padrão |
|---|---|---|
| Título | texto | obrigatório |
| Instruções para o aluno | texto | vazio |
| Liberação dos blocos | `progressive` (mesmo bloqueio por bloco do D11) · `all` (tudo liberado, para tarefa depois de assistir) | `progressive` |
| Mostrar explicação após cada resposta | sim · não (o professor prefere discutir em aula) | sim |
| Nível indicativo | A2 · B1 · B2 · C1 · nenhum (só um rótulo; o aluno não filtra por nível) | nenhum |

### 16.4.3 Regras de conteúdo (validadas no cliente e de novo no servidor)

| Campo | Regra |
|---|---|
| Título | 1–80 caracteres |
| Instruções | ≤ 500 caracteres |
| Enunciado | 1–300 caracteres |
| Alternativas | 2 a 4, cada uma com 1–150 caracteres; "Verdadeiro ou falso" usa sempre `["True", "False"]` |
| Resposta certa | obrigatória e dentro das alternativas |
| Explicação EN / PT-BR | opcionais, ≤ 500 caracteres cada |
| Momento aproximado | obrigatório em pergunta própria; entre `00:00` e a duração do episódio |
| Citação do diálogo | opcional, no máximo 1 por pergunta e ≤ 15 palavras (mesma regra do NFR-08) |
| Perguntas por quiz | 1 a 80 |
| Documento | ≤ 64 KB |
| Formatação | só texto puro: sem HTML, Markdown ou links clicáveis (renderizado como texto, nunca como HTML) |

Aviso fixo no editor: **"Qualquer pessoa com o link vê este quiz. Não escreva dados pessoais (nomes completos, telefones, e-mails). Uso pessoal e educacional, sem fins comerciais."**

### 16.4.4 Rascunho
O rascunho fica **só no aparelho** (`st:drafts`) até o professor tocar em "Publicar". Nada vai ao servidor antes disso. Fechar o app não perde o rascunho; trocar de aparelho, sim.

## 16.5 Identidade sem conta: link do aluno e link de edição

| Item | Formato | Onde vive | Observação |
|---|---|---|---|
| `shareCode` | 8 caracteres em Base32 de Crockford (sem `I`, `L`, `O`, `U`), ex.: `K7M2Q9XA` (~1,1 trilhão de combinações) | URL pública `/q/K7M2Q9XA` e banco | **Não listado** (não aparece em busca nem em listagem), mas **não é segredo**: quem tem o link vê o quiz. Colisão na criação: sortear de novo (até 3 vezes) |
| `editToken` | 32 bytes aleatórios (gerador criptográfico), em base64url | Aparelho do professor (`st:shared`) e link de edição; no banco, **só o SHA-256** | Mostrado uma única vez, na resposta da publicação |
| Link de edição | `/q/K7M2Q9XA/edit#t={editToken}` | Onde o professor guardar | O token vai no **fragmento** (`#`): o navegador não o envia ao carregar a página, então ele não aparece em logs nem no `Referer`. A tela lê o fragmento e manda o token em `Authorization: Bearer` |

- **Checagem:** o servidor calcula o SHA-256 do token recebido e compara com o guardado usando comparação em tempo constante. Erro sempre como `EDIT_TOKEN_INVALID`, sem dizer se o quiz existe.
- **"Meus quizzes"** lista o que está em `st:shared`, então no mesmo aparelho o professor não precisa do link de edição.
- **Perdeu o aparelho e o link de edição:** não há recuperação, porque não existe conta. O quiz continua no ar até expirar (16.8). Para se prevenir, o professor pode guardar o link de edição ou exportar o JSON local (US-13), com a opção "incluir links de edição".
- **O link de edição vazou:** "Gerar novo link de edição" troca o token, e o antigo deixa de valer na hora.
- **Abrir o link de edição em outro aparelho** funciona e passa a listar o quiz em "Meus quizzes" daquele aparelho.

## 16.6 Modelo de dados (incorporar ao item 5)

### 16.6.1 Tabela `shared_quizzes`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `text` PK | |
| `share_code` | `text` único | |
| `edit_token_hash` | `text` | SHA-256 em hex; o token em si nunca é gravado |
| `status` | `text` | `published` · `unpublished` · `removed` (moderação) |
| `version` | `integer` | começa em 1; +1 a cada edição publicada |
| `episode_key` | `text` | `tmdb-{série}-s{SS}-e{EE}`; índice |
| `source_quiz_key` | `text` nulo | `episodeKey` do quiz da IA de origem, quando houver |
| `document` | `jsonb` | `SharedQuizDocument` (16.6.2) |
| `created_at`, `updated_at` | `timestamptz` | |
| `expires_at` | `timestamptz` | publicação ou última renovação + 150 dias; índice |

**Não existem** colunas de autor, nome, e-mail, IP, `deviceId` ou respostas de alunos. O rate limit usa a tabela `rate_limit_counters` que já existe (IP só como hash com sal e com prazo de expiração, NFR-07).

### 16.6.2 Documento

```ts
// shared/types/sharedQuiz.ts — esboço; os limites de 16.4.3 viram .min/.max no Zod
export const SharedQuestionSchema = z.object({
  id: z.string(),
  origin: z.enum(['ai', 'ai_edited', 'teacher']),
  level: CefrLevelSchema.nullable(),          // perguntas próprias podem não ter nível
  type: QuestionTypeSchema,
  prompt: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int(),
  approxTimeSeconds: z.number(),              // posiciona a pergunta no bloco e na ordem cronológica
  quote: z.string().nullable(),               // citação ≤ 15 palavras; sem IDs de linha (L042), que são internos
  explanation: z.string().nullable(),
  explanationPt: z.string().nullable(),
});

export const SharedQuizDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string(),
  instructions: z.string().nullable(),
  levelLabel: CefrLevelSchema.nullable(),
  unlockMode: z.enum(['progressive', 'all']),
  showExplanations: z.boolean(),
  episode: z.object({
    episodeKey: z.string(),
    seriesId: z.number(), seasonNumber: z.number(), episodeNumber: z.number(),
    seriesTitle: z.string(), episodeTitle: z.string(), runtimeMinutes: z.number(),
    titlesSyncedAt: z.string(),                // renovado junto com expires_at (16.8)
  }),
  segments: z.array(z.object({
    id: z.string(), index: z.number(),
    startSeconds: z.number(), endSeconds: z.number(), label: z.string(),
    questions: z.array(SharedQuestionSchema),
  })),
});
```

### 16.6.3 No aparelho (complementa o ADR-011)

| Chave | Conteúdo |
|---|---|
| `st:shared` | Quizzes publicados por este aparelho: `{shareCode, editToken, title, episodeKey, version, expiresAt}` |
| `st:drafts` | Rascunhos ainda não publicados |
| `st:history` | Tentativas de quizzes compartilhados com `source: 'shared'`, `shareCode`, `version` e, enquanto a tentativa está em andamento, uma cópia do documento (16.11) |

## 16.7 Contrato da API (incorporar ao item 6)

| Método e rota | Autenticação | Entrada → saída | Observações |
|---|---|---|---|
| `POST /api/shared-quizzes` | `X-Access-Code` (A8) | `{document}` → `201 {shareCode, editToken, version, expiresAt}` | Único momento em que o `editToken` sai do servidor |
| `GET /api/shared-quizzes/{shareCode}` | — | → `200 {shareCode, version, expiresAt, document}` | Inexistente, despublicado, removido ou expirado: sempre o mesmo `404 SHARED_QUIZ_NOT_FOUND`. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` |
| `PUT /api/shared-quizzes/{shareCode}` | `Bearer editToken` | `{document, baseVersion}` → `200 {version}` | `409 VERSION_CONFLICT` se `baseVersion` não for a versão atual (dois aparelhos editando) |
| `PATCH /api/shared-quizzes/{shareCode}` | `Bearer editToken` | `{status: 'published' \| 'unpublished'}` → `200` | Despublicar sem apagar |
| `POST /api/shared-quizzes/{shareCode}/renew` | `Bearer editToken` | → `200 {expiresAt}` | Renova o prazo e os títulos da TMDB (16.8) |
| `POST /api/shared-quizzes/{shareCode}/rotate-token` | `Bearer editToken` | → `200 {editToken}` | O token anterior deixa de valer |
| `DELETE /api/shared-quizzes/{shareCode}` | `Bearer editToken` | → `204` | Apaga de vez |
| `POST /api/admin/shared-quizzes/{shareCode}/remove` | `ADMIN_TOKEN` | → `200` | Moderação: `status = removed` |

| Código de erro | HTTP | Quando |
|---|---|---|
| `SHARED_QUIZ_NOT_FOUND` | 404 | Ver `GET` acima |
| `SHARED_QUIZ_INVALID` | 422 | Documento fora das regras de 16.4.3; devolve a lista de campos reprovados |
| `EDIT_TOKEN_INVALID` | 403 | Token ausente ou errado, sem dizer se o quiz existe |
| `VERSION_CONFLICT` | 409 | Edição em cima de versão antiga |
| `SHARED_QUIZ_LIMIT_REACHED` | 503 | Limite global de quizzes ativos (`SHARED_QUIZ_MAX_ACTIVE`, padrão 500) |
| `INVALID_ACCESS_CODE` / `RATE_LIMITED` | 403 / 429 | Mesmos códigos já usados na geração |

Rate limit (complementa a tabela do ADR-006):

| Bucket | Limite padrão |
|---|---|
| `share:create:ip` | 10/dia |
| `share:write:ip` (`PUT`, `PATCH`, `renew`, `rotate-token`, `DELETE`) | 60/h |
| `share-token-fail:ip` | 10/h (bloqueio de 1 h) |
| `read:ip` | já existe: 120/min, cobre o `GET` |

## 16.8 Retenção, TMDB e conformidade

- **Expiração:** 150 dias depois da publicação ou da última renovação. O prazo fica abaixo do limite de 6 meses da TMDB para os títulos copiados no documento (ADR-010) e limpa quizzes abandonados. "Renovar" busca os títulos de novo na TMDB e empurra o prazo. O cron diário que já existe (GitHub Actions) apaga os expirados.
- **Aviso de expiração:** sem e-mail, porque não há conta. "Meus quizzes" mostra "Expira em dd/mm" e destaca os que vencem em até 15 dias.
- **Citações:** perguntas vindas da IA mantêm a evidência que já passou pelo orçamento do ADR-008. Perguntas próprias têm no máximo 1 citação de até 15 palavras. Nenhum quiz compartilhado guarda trecho longo de legenda.
- **Uso comercial ⚠️:** um professor usando o app num curso pago pode configurar uso comercial da TMDB, da OpenSubtitles e do plano Hobby da Vercel (premissa P1). O editor mostra o aviso de 16.4.3. Se houver demanda real de uso pago, rever os termos antes de qualquer coisa.
- **Conteúdo de terceiros:** o texto é de quem publica. A moderação é feita pelo endpoint de admin (`removed`). Todo texto do professor é exibido como texto puro, o que fecha a porta para XSS.
- **LGPD:** como o servidor não guarda nada que identifique professor ou aluno, a página Sobre só precisa explicar que o quiz compartilhado é público para quem tem o link e que o resultado do aluno não sai do aparelho sem ação dele.

## 16.9 Telas (incorporar ao item 9)

| Tela | Rota | Conteúdo |
|---|---|---|
| Ponto de entrada | Quiz da IA e lista de episódios | Botão "Criar quiz para compartilhar" (visível para todos; o código só é pedido ao publicar) |
| Editor | `/shared/new/{seriesId}/{seasonNumber}/{episodeNumber}` | Opções (16.4.2), banco da IA com filtros e caixas de seleção, "Adicionar pergunta própria", pré-visualização como aluno, "Publicar" |
| Publicado | modal | Link do aluno com "Copiar" e "Compartilhar" (Web Share API); link de edição com o aviso "Guarde este link: é o único jeito de editar em outro aparelho" |
| Meus quizzes | `/shared` (atalho em Histórico) | Lista de `st:shared`: título, episódio, versão, expira em; ações Editar, Renovar, Copiar link, Despublicar/Publicar, Novo link de edição, Apagar (com confirmação) |
| Quiz do aluno | `/q/{shareCode}` | Cabeçalho com título, instruções e episódio; o mesmo player de blocos do quiz da IA, sem seletor de nível; selo "Quiz compartilhado"; no fim, "Enviar resultado ao professor" |
| Edição | `/q/{shareCode}/edit#t=…` | O editor, carregado do servidor com o token do fragmento |

A tela do aluno reaproveita o player do quiz da IA. Na Fase 8, o player vira um componente que recebe o documento e as opções (`unlockMode`, `showExplanations`, filtro de nível ligado ou desligado).

## 16.10 Resultado do aluno sem servidor

No fim do quiz, "Enviar resultado ao professor" monta um texto no próprio aparelho e abre o compartilhamento nativo (Web Share API), com "Copiar" como alternativa:

```
Segunda Tela · "Aula 3 — Victorious S01E01" (K7M2Q9XA, v2)
Nome: Ana
Acertos: 8/10 (80%) · Bloco 1: 3/3 · Bloco 2: 2/4 · Bloco 3: 3/3
Errei: 4, 7
```

- O nome é **opcional**, digitado na hora e guardado só no aparelho, para preencher da próxima vez.
- Nada passa pelo servidor. O professor recebe pelo canal que o aluno escolher.
- Não há verificação: o aluno pode editar o texto. É feedback formativo, não avaliação. Um resultado verificável fica para o pós-MVP (16.13).

## 16.11 Casos de borda

| Situação | Comportamento |
|---|---|
| Professor publica nova versão enquanto o aluno responde | O aluno termina na versão em que começou (cópia local do documento). Ao reabrir o link: "O professor atualizou este quiz (v3)", com "Recomeçar na nova versão" |
| Quiz despublicado, removido, apagado ou expirado | O aluno vê "Este quiz não está mais disponível"; a tentativa local continua no histórico |
| Quiz da IA de origem é regenerado | Sem efeito: o compartilhado é uma cópia |
| Dois aparelhos do professor editando | `409 VERSION_CONFLICT`; a tela oferece recarregar a versão atual e reaplicar as mudanças |
| Professor sem código de acesso | Monta o rascunho normalmente; "Publicar" pede o código (A8) |
| Episódio sem quiz da IA | Só o modo "do zero" |
| Mesmo aluno abre o link duas vezes | Cada conclusão é uma tentativa nova no histórico local, como no quiz da IA (US-11) |
| Link aberto no desktop | Funciona; a experiência é pensada para celular |

## 16.12 Testes (complementa o item 11)

- **Unitários:** validação do documento (limites de 16.4.3, citação ≤ 15 palavras, momento dentro da duração, montagem dos blocos); geração do `shareCode` (alfabeto e nova tentativa em colisão); hash e comparação do token.
- **Contrato (PGlite):** `POST → GET → PUT` com token certo e errado; `404` idêntico para inexistente, despublicado e expirado; `409` de versão; rate limits; um teste que lista as colunas de `shared_quizzes` e falha se aparecer qualquer coluna de identificação.
- **E2E (Playwright):** o professor monta a partir do quiz da IA e publica; o aluno abre o link em outro contexto de navegador, sem nada no `localStorage`, responde e copia o resultado.
- **Privacidade:** o logger redige o cabeçalho `Authorization`, e um teste garante que o `editToken` não aparece em nenhuma linha de log.

## 16.13 Evolução (pós-MVP; exige guardar dados de usuário)

| Item | Por que fica para depois |
|---|---|
| Conta de professor (login) com recuperação dos quizzes em qualquer aparelho | Guarda e-mail; exige envio de e-mail e política de privacidade (LGPD) |
| Turmas e painel de resultados por pergunta | Guarda respostas de alunos; exige consentimento |
| Resultado verificável (assinado pelo servidor) | Exige guardar ou assinar tentativas |
| Biblioteca pública de quizzes de professores | Exige moderação ativa |
| Estatísticas anônimas por pergunta (só contadores, sem identificação) | Não guarda dado pessoal, mas grava a cada resposta; ver decisão A10 |

## 16.14 Plano da Fase 8

| # | Tarefa | Pronto quando |
|---|---|---|
| 1 | Schemas Zod em `shared/` (16.6.2) e regras de 16.4.3 | Testes unitários passando |
| 2 | Tabela `shared_quizzes` com migração e repositório | Teste de colunas sem identificação passando |
| 3 | Endpoints de 16.7, token de edição e buckets de rate limit | Testes de contrato passando |
| 4 | Extrair o player do quiz da IA para um componente reutilizável | O quiz da IA continua igual (E2E existente passa) |
| 5 | Tela do aluno `/q/{shareCode}` com cópia local por versão | E2E do aluno passando |
| 6 | Editor, rascunho local e modal de publicação | E2E do professor passando |
| 7 | "Meus quizzes": renovar, despublicar, novo link de edição, apagar | Ações testadas contra a API |
| 8 | Resultado compartilhável (16.10) | Texto gerado conferido em teste |
| 9 | Cron de expiração e endpoint de moderação | Expirados somem do `GET` e do banco |
