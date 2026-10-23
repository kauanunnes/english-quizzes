# 12. Segurança, privacidade e conformidade

> Não sou advogado. Esta seção reduz riscos técnicos e organiza o que os termos pedem; para uso público ou comercial, consulte um profissional.

## 12.1 Ameaças e controles

| Ameaça | Exemplo | Controles |
|---|---|---|
| Vazamento de segredos | chave no bundle, em log ou em repositório | Segredos só em variáveis do servidor (nenhum `VITE_*` sensível); checagem no build (`grep` no `dist/`); redação de `Authorization`, `Api-Key` e `X-Access-Code` no logger; `.env*` no `.gitignore`; GitHub secret scanning ligado |
| Abuso de custo | alguém gera quizzes em loop | Código de acesso, rate limit por IP/dispositivo, tetos diários de gerações e US$, limite de gasto no Console da Anthropic (ADR-006) |
| Força bruta no código | tentativa de adivinhar | Comparação em tempo constante; 5 erros/h por IP; código longo (frase de 4+ palavras) |
| Injeção de prompt | fala de legenda com instruções | R15/R16, dados entre tags, regra 11 do prompt, sem ferramentas, saída restrita ao schema e validada (§8.9) |
| XSS | texto da LLM ou da TMDB com HTML | React escapa tudo; `dangerouslySetInnerHTML` proibido por lint; CSP restritiva; nada renderizado como HTML |
| CSRF | site de terceiros disparando `POST` | `Origin` obrigatório e igual a `APP_ORIGIN`; código em cabeçalho (não em cookie); sem cookies de sessão no MVP |
| SSRF | link de download apontando para endereço interno | Baixar só `https` de hosts na allowlist (`*.opensubtitles.com`, `*.opensubtitles.org` ⚠️ confirmar com a fixture); no máximo 2 redirecionamentos, todos dentro da allowlist; limite de 2 MB e 15 s |
| Upload malicioso | arquivo enorme ou binário | Limite de 1 MB; extensão + detecção de formato (F01–F05); nunca gravado; nome do arquivo ignorado |
| Abuso do catálogo | scraping do nosso proxy | Bucket `read:ip` (120/min) e cache na CDN |
| Vazamento por log | texto de legenda ou prompt em log | Regra de §7.13 com teste que falha; logs sem corpo de requisição nem resposta da LLM |
| Token de admin vazado | — | 32+ bytes aleatórios; só no GitHub Secrets e na Vercel; rotação documentada (§13.10) |
| Cadeia de dependências | pacote comprometido | Lockfile, Dependabot/Renovate, `pnpm audit` semanal, poucas dependências |
| Sessão da OpenSubtitles vazada do banco | uso indevido da conta | Token cifrado com AES-256-GCM (`TOKEN_ENCRYPTION_KEY`), expira em ≤ 12 h |

## 12.2 Cabeçalhos HTTP (produção)

| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'sha256-<hash-do-script-de-tema>'; style-src 'self'; img-src 'self' data: https://image.tmdb.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Content-Type-Options` | `nosniff` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (se usar domínio próprio) |

Se adotar Sentry, acrescente o host de ingestão em `connect-src`. O hash do script de tema (§9.10) é gerado no build e conferido por teste.

## 12.3 Privacidade (LGPD)

| Dado | Onde | Base e finalidade | Retenção |
|---|---|---|---|
| Histórico, configurações, progresso, favoritos | só no aparelho | execução do serviço pedido pelo usuário | até o usuário apagar |
| `deviceId` (UUID aleatório) | aparelho; no servidor só como hash com sal | segurança e limite de uso (legítimo interesse) | jobs: 30–90 dias; contadores: ≤ 2 dias |
| IP | no servidor só como hash com sal | segurança e limite de uso | idem |
| Comentário em relato de pergunta [MVP+] | servidor | melhoria de qualidade | 180 dias |
| Logs da plataforma | Vercel | operação | conforme o plano ⚠️ (no Hobby a retenção é curta; os dados operacionais importantes já ficam no banco) |

- Sem contas, sem e-mail, sem rastreadores de terceiros e sem analytics no MVP.
- O campo de comentário do relato avisa "Não inclua dados pessoais" e tem até 280 caracteres.
- Página Sobre traz um resumo de privacidade (o que fica no aparelho, o que fica no servidor, por quanto tempo) e um contato.
- Apagar dados locais: botão nas configurações. Dados no servidor ligados a um aparelho: removidos sob pedido pelo contato (raro, porque são pseudônimos de curta duração).

## 12.4 Conformidade com os termos das APIs

### TMDB
- [ ] Uso não comercial (premissa P1); uso comercial exige licença. ✅
- [ ] Atribuição na tela Sobre: logo aprovado, menos proeminente que a marca do app, e o aviso exato de §4.1.7. ✅
- [ ] Nenhum dado cacheado por mais de 6 meses (§5.7). ✅
- [ ] Não sugerir endosso ou parceria com a TMDB.
- [ ] Imagens servidas pelo CDN da TMDB, nunca copiadas.
- [ ] Nenhum dado da TMDB enviado à LLM por padrão (§8.10); ler a cláusula sobre IA nos API Terms antes de ligar o experimento A3. ⚠️

### OpenSubtitles
- [ ] Uso não comercial (os termos proíbem uso comercial). ✅
- [ ] API key do desenvolvedor, nunca do usuário final; `User-Agent` descritivo. ✅
- [ ] Respeitar a cota da própria conta; **não** usar várias contas para contornar o limite.
- [ ] Não redistribuir, exibir ou armazenar legendas (ADR-009).
- [ ] Crédito "Legendas: OpenSubtitles.com" com link na tela Sobre (boa prática; não achei exigência formal ⚠️).
- [ ] **Antes do lançamento:** escrever ao suporte descrevendo o uso (processar a legenda com uma LLM para gerar perguntas, sem armazenar nem exibir o texto) e guardar a resposta. Os termos que encontrei não tratam disso. ⚠️

### Anthropic (LLM)
- [ ] Seguir a política de uso da Anthropic.
- [ ] Pela documentação oficial de retenção da API, dados retidos não são usados para treinar modelos sem permissão expressa, e o conteúdo das conversas não é retido por padrão, exceto em "Covered Models" (família Fable/Mythos), que exigem 30 dias. Sonnet e Haiku, usados aqui, não estão nessa exceção. Exceções por violação de política podem estender a retenção ⚠️ conferir a página vigente antes do lançamento.
- [ ] Nenhuma PII nos prompts (por construção: só falas de série e metadados técnicos).
- [ ] Limite de gasto mensal configurado no Console.

### Hospedagem
- [ ] Vercel Hobby é para uso pessoal e não comercial ⚠️ conferir os termos vigentes; se o projeto virar comercial, mudar de plano (e de licença na TMDB).
- [ ] Neon Free: dentro de 0,5 GB e 100 CU-horas/mês (alerta a 70%).

## 12.5 Direitos autorais (legendas e diálogos)

| Item | Política |
|---|---|
| Arquivo ou texto da legenda | Processado só em memória; nunca armazenado, logado, exibido ou distribuído |
| Citações de evidência | ≤ 15 palavras cada; exibidas só depois da resposta |
| Frases de "complete a lacuna" | Uma fala, no máximo 1 por bloco pelo plano de slots |
| Total citado por episódio | ≤ 15% das palavras do diálogo (P04), em geral bem menos |
| Letras de música | Linhas cantadas descartadas no parser (R10) |
| Perguntas, alternativas e explicações | Texto original gerado; não reproduz o roteiro |
| Origem | Série e episódio sempre identificados junto ao quiz |
| Pedido de remoção | Contato na tela Sobre → `POST /api/admin/quizzes/{id}/withdraw` em até 72 h → registro do pedido |

Contexto legal, sem garantia: a lei brasileira de direitos autorais (Lei 9.610/98, art. 46) admite citação de trechos para estudo, crítica ou polêmica, na medida justificada e com indicação da origem ⚠️ (interpretação a confirmar com profissional). O desenho acima mantém as citações curtas, contextualizadas e com finalidade educacional, mas isso não substitui uma avaliação jurídica se o app for público.

## 12.6 Checklist antes do lançamento
- [ ] Nenhum segredo no bundle (checagem do build verde).
- [ ] CSP e cabeçalhos de §12.2 ativos (conferir com `curl -I`).
- [ ] Código de acesso, rate limit, tetos diários e limite no Console da Anthropic ativos e testados.
- [ ] Allowlist de host do download e limites de tamanho/tempo testados.
- [ ] Logger com redação testado; teste de "texto de legenda em log" verde.
- [ ] Tela Sobre com atribuição TMDB exata, crédito OpenSubtitles, aviso de IA, privacidade e contato.
- [ ] Resposta do suporte da OpenSubtitles arquivada (ou decisão consciente de seguir sem ela).
- [ ] Manutenção de 6 meses da TMDB agendada e executada uma vez.
- [ ] `pnpm audit` sem vulnerabilidades altas; Dependabot ligado.
- [ ] Runbook de rotação de chaves testado uma vez (§13.10).
