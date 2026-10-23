# 14. Backlog pós-MVP (priorizado)

Critério: valor para quem estuda com a segunda tela ÷ esforço, com bônus para o que destrava outros itens. Esforço: P ≤ 1 dia, M 2–4 dias, G 5–10 dias.

| # | Item | Valor | Esforço | Depende de | Notas de desenho |
|---|---|---|---|---|---|
| 1 | **PWA instalável** + quizzes já abertos disponíveis offline | Alto: abre como app no celular; funciona com Wi-Fi ruim | M | — | Manifest, service worker (cache de shell e dos `GET …/quiz` já vistos); nunca cachear `/api/jobs` nem `/api/quota` |
| 2 | **Vocabulário salvo + flashcards com repetição espaçada** | Alto: transforma cada episódio em revisão | G | 1 (opcional) | Fonte: `focus` das perguntas (`FavoritesV1.expressions`); algoritmo SM-2 ou FSRS local; cartão = expressão + significado + citação curta do episódio |
| 3 | **Ajuste de deslocamento de tempo** ("minha versão está X s adiantada") | Médio: horários batem com o streaming | P | — | Offset por episódio salvo na tentativa; aplicado na exibição de "≈mm:ss" |
| 4 | **Tradução PT-BR de enunciados e alternativas** (sob demanda) | Médio: apoio para A2/B1 | P | — | Chamada à LLM só com a pergunta já armazenada (não precisa da legenda); resultado cacheado no quiz |
| 5 | **Login e sincronização** | Alto quando houver mais de um aparelho | G | 2 | Opções: Better Auth/Neon Auth (mesmo banco) ou Clerk; migrar o histórico local via `deviceId`; RLS ou checagem por usuário nas rotas |
| 6 | **Painel de progresso** | Médio: motivação | M | 5 (ou local) | Acerto por nível e tipo ao longo do tempo, sequência de dias, expressões aprendidas |
| 7 | **Modo "assistir junto"** (perguntas liberadas por tempo) | Alto para quem assiste sem pausar | G | 3 | Cronômetro com início sincronizado a uma fala ("toque quando ouvir: …"), Wake Lock, pausa/retomada; libera cada pergunta logo após o `evidence.endMs` |
| 8 | **Pré-geração inteligente** dos próximos 2 episódios da série em andamento | Médio: zero espera | P | F7 (fila) | Enfileira a partir do `ProgressV1`; respeita reserva e orçamento |
| 9 | **Notificação quando o quiz ficar pronto** (Web Push) | Médio | M | 1 | Exige PWA e permissão; payload sem conteúdo do quiz |
| 10 | **Message Batches API para a pré-geração** | Baixo/médio: ~50% mais barato | P | 8 | A saída estruturada funciona com Batches; resultados assíncronos encaixam no lote noturno |
| 11 | **Regerar um bloco específico** a partir de relatos | Médio: qualidade | M | F7 (relatos) | Exige novo download (a legenda não é guardada); só para admin |
| 12 | **Exportar vocabulário para Anki** (CSV) | Baixo/médio | P | 2 | Campos: expressão, significado, exemplo curto, série/episódio |
| 13 | **Suporte a filmes** | Médio | M | — | OpenSubtitles com `tmdb_id`/`imdb_id` do filme; blocos de 5 min já funcionam |
| 14 | **SubDL como fallback automático** | Baixo/médio | P | termos lidos (A4) | Interface `SubtitleProvider` (§4.2.11); `.zip` → extrair `.srt` em memória |
| 15 | **Níveis A1 e C2** | Baixo | P | eval | Ajustar plano de slots e rubrica |

Fora de escopo continua valendo: reproduzir vídeo, hospedar/distribuir legendas, app nativo.
