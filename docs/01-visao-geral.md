# 1. Visão geral

## 1.1 Problema

Quem estuda inglês assistindo séries esbarra em três coisas:

1. **Assistir é passivo.** Sem um momento de checagem, você não sabe se entendeu ou se só acompanhou pelas imagens.
2. **Pausar quebra a experiência.** Parar a cada cena para conferir o que ouviu faz desistir em poucos dias.
3. **Exercício genérico não gruda.** Listas de vocabulário soltas não usam as expressões que você acabou de ouvir, no contexto em que apareceram.

As ferramentas existentes funcionam *dentro* do player (extensões de navegador com legenda dupla), o que não serve para quem assiste na TV.

## 1.2 Solução

Um app web de **segunda tela**: você assiste o episódio onde quiser e usa o celular para responder perguntas sobre o que acabou de ouvir.

1. Busca a série (catálogo da TMDB) e escolhe temporada e episódio.
2. O app encontra a legenda em inglês na OpenSubtitles, extrai só as falas e pede a uma LLM um banco de perguntas **ancoradas no diálogo**, com evidência (trecho curto + tempo).
3. As perguntas aparecem **por blocos de ~5 minutos, em ordem cronológica**. O bloco seguinte só abre quando você diz que já assistiu até aquele ponto, então não há spoiler.
4. Cada resposta tem feedback imediato e explicação (inglês, com opção em português). O histórico fica no aparelho.

O quiz de cada episódio é gerado **uma única vez** e fica em cache para todos os usuários; a legenda em si nunca é armazenada.

## 1.3 Objetivos do MVP

| ID | Objetivo | Meta mensurável |
|---|---|---|
| O1 | Gerar quiz para episódios de séries em inglês | ≥ 90% de sucesso na 1ª tentativa, quando existe legenda EN |
| O2 | Abrir rápido um quiz já gerado | p95 < 1,5 s do toque até a 1ª pergunta (4G) |
| O3 | Gerar um quiz novo em tempo tolerável | p95 ≤ 90 s (episódio de 22 min) e ≤ 150 s (45 min) |
| O4 | Perguntas corretas e ancoradas | ≥ 90% "aceitáveis" na rubrica; 100% com evidência válida; 0 perguntas sobre o que se vê |
| O5 | Zero spoiler | 0 perguntas cuja evidência esteja depois do fim do bloco |
| O6 | Custo baixo | Com Sonnet: ≤ US$ 0,20 por episódio de ~22 min (≈ US$ 0,35 para 45 min); com Haiku: ≤ US$ 0,02 por episódio; total ≤ US$ 10/mês |
| O7 | Usar bem a cota de legendas | Média ≤ 1,2 downloads por quiz pronto |

## 1.4 Não-objetivos

- Reproduzir vídeo/áudio ou sincronizar automaticamente com o player.
- Hospedar, exibir ou distribuir legendas (nem o arquivo, nem trechos longos).
- App nativo, uso comercial, monetização.
- Perguntas sobre o que se vê (roupas, cenário, ações sem fala).
- Pronúncia, ditado com áudio ou reconhecimento de voz.
- Garantir qualidade para séries cujo áudio original não é inglês.

## 1.5 Persona

**Lucas, 31 anos, desenvolvedor em Belo Horizonte, inglês B1 indo para B2.**

- Assiste um episódio por noite na TV (streaming), geralmente com a luz apagada e o celular na mão.
- Quer treinar listening sem pausar; aceita esperar cerca de um minuto, uma vez por episódio, pela geração.
- Prefere sitcoms (episódios de ~22 min) e de vez em quando um drama de ~45 min.
- Usa iPhone; às vezes o celular bloqueia no meio do episódio.
- Dispõe de 20–40 minutos por dia.

**Job to be done:** "Quando termino um trecho do episódio, quero responder duas ou três perguntas rápidas sobre o que ouvi, para saber se entendi sem pausar, e sair com uma ou duas expressões novas."

**Persona secundária:** amigos convidados (2–5 pessoas) que recebem o link. Sem o código de acesso, só respondem quizzes já gerados.

## 1.6 Métricas de sucesso

| Métrica | Definição | Meta | Fonte |
|---|---|---|---|
| Sucesso de geração | jobs `ready` ÷ jobs criados (excluindo falhas por cota) | ≥ 90% | tabela `generation_jobs` |
| Tempo de geração | `created_at` → `finished_at`, p50 / p95 (22 min) | ≤ 45 s / ≤ 90 s | `generation_jobs` |
| Downloads por quiz | downloads ÷ quizzes prontos | ≤ 1,2 | `subtitle_selections` |
| Custo por quiz | Σ tokens × preço | ≤ US$ 0,20 para 22 min com Sonnet (≈ US$ 0,35 para 45 min) | `quizzes.usage`, `usage_daily` |
| Perguntas reportadas | reports ÷ perguntas exibidas | ≤ 2% | `question_reports` |
| Nota de qualidade | Rubrica nos 5 episódios de referência (item 11) | média ≥ 4,2/5; 0 erros críticos | script de avaliação |
| Engajamento | % das perguntas respondidas por quiz iniciado | ≥ 70% | histórico local |
| Aprendizado | Taxa de acerto por nível em janelas de 2 semanas | tendência de alta | histórico local |

## 1.7 Escopo

| MVP | Pós-MVP (item 14, priorizado) | Fora de escopo |
|---|---|---|
| Busca de séries; temporadas e episódios | Login e sincronização | Reproduzir vídeo |
| Geração e cache do quiz (job + polling) | Vocabulário salvo e flashcards com repetição espaçada | Hospedar/distribuir legendas |
| Responder por blocos, feedback, pontuação | Painel de progresso | App nativo |
| Histórico e configurações locais | Modo "assistir junto" (perguntas liberadas por tempo) | Uso comercial |
| Modo sem spoiler, dark mode, acessibilidade | PWA instalável | |
| Atribuição TMDB e página Sobre | Tradução PT-BR de enunciados e alternativas | |
| [MVP+] Upload manual de legenda, pré-geração em lote, relatório de pergunta com problema, painel de uso | | |

## 1.8 Restrições que moldam o projeto

| Restrição | Consequência no desenho |
|---|---|
| OpenSubtitles: 20 downloads/24 h na conta grátis | Cache permanente por episódio; no máximo 2 downloads por episódio; reserva de cota para uso interativo |
| TMDB: uso gratuito só não comercial; cache ≤ 6 meses; atribuição obrigatória | CDN com TTL curto; renovação dos metadados no banco antes de 6 meses; página de créditos |
| Legendas são conteúdo protegido | Texto processado só em memória; armazenar só o quiz derivado com citações curtas |
| Vercel Hobby: função de até 300 s, uso não comercial | Chamadas por bloco em paralelo; deadline do job em 240 s |
| Uma pessoa mantém tudo | Nenhum servidor para administrar; poucos fornecedores; tudo configurável por variável de ambiente |
