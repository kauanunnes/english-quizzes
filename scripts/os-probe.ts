// Fase 1 (docs/04 §4.2.12): descobre o ID da série na TMDB, roda as consultas E1–E5 da OpenSubtitles
// e grava em tests/fixtures/opensubtitles/ SOMENTE metadados, com uploaders anonimizados.
// Busca não consome cota de download. Nada de legenda é baixado aqui.
//
// Uso: pnpm os-probe [--query "Victorious"] [--series-id 31586] [--season 1] [--episodes 1,4] [--login]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildSubtitleQuery } from '../src/server/integrations/opensubtitles/query.ts';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const OS_BASE = 'https://api.opensubtitles.com/api/v1';
const FIXTURES_DIR = path.join('tests', 'fixtures', 'opensubtitles');

const { values: args } = parseArgs({
  options: {
    query: { type: 'string', default: 'Victorious' },
    'series-id': { type: 'string' },
    season: { type: 'string' },
    episodes: { type: 'string' },
    login: { type: 'boolean', default: false },
  },
});

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`os-probe: defina ${key} no .env.local ou .env`);
    process.exit(1);
  }
  return value;
}

const tmdbToken = requireEnv('TMDB_READ_TOKEN');
const osApiKey = requireEnv('OPENSUBTITLES_API_KEY');
const userAgent = process.env.OPENSUBTITLES_USER_AGENT || 'SegundaTela v0.1.0';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tmdb<T>(pathAndQuery: string): Promise<T> {
  const res = await fetch(`${TMDB_BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} em ${pathAndQuery.split('?')[0]}`);
  return (await res.json()) as T;
}

type TmdbSearch = { results: { id: number; name: string; original_name: string; original_language: string; first_air_date?: string }[] };
type TmdbEpisode = { id: number; name: string; runtime: number | null; external_ids?: { imdb_id?: string | null } };
type TmdbSeries = { id: number; name: string; external_ids?: { imdb_id?: string | null } };

async function resolveSeriesId(): Promise<number> {
  if (args['series-id']) return Number(args['series-id']);
  if (process.env.TRACER_SERIES_ID) return Number(process.env.TRACER_SERIES_ID);

  const search = await tmdb<TmdbSearch>(`/search/tv?query=${encodeURIComponent(args.query)}&include_adult=false&language=en-US`);
  const wanted = args.query.toLowerCase();
  const match =
    search.results.find((r) => r.original_name.toLowerCase() === wanted && r.original_language === 'en') ??
    search.results[0];
  if (!match) throw new Error(`nenhuma série encontrada para "${args.query}"`);
  console.log(`TMDB: "${match.original_name}" (${match.first_air_date?.slice(0, 4) ?? '?'}) → TRACER_SERIES_ID=${match.id}`);
  return match.id;
}

// Uploaders viram uploader_1, uploader_2…; o resto são metadados da legenda
const uploaderAliases = new Map<string, string>();
function anonymize(item: Record<string, unknown>): Record<string, unknown> {
  const attributes = { ...(item.attributes as Record<string, unknown>) };
  const uploader = attributes.uploader as { name?: string; rank?: string } | undefined;
  if (uploader) {
    const key = uploader.name ?? 'unknown';
    if (!uploaderAliases.has(key)) uploaderAliases.set(key, `uploader_${uploaderAliases.size + 1}`);
    attributes.uploader = { uploader_id: null, name: uploaderAliases.get(key), rank: uploader.rank ?? null };
  }
  return { ...item, attributes };
}

function typeShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.length > 0 ? [typeShape(value[0])] : [];
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeShape(v)]));
  }
  return value === null ? 'null' : typeof value;
}

async function searchSubtitles(query: string) {
  const res = await fetch(`${OS_BASE}/subtitles?${query}`, {
    headers: { 'Api-Key': osApiKey, 'User-Agent': userAgent, Accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  });
  if (res.status >= 300 && res.status < 400) {
    return { status: res.status, redirect: res.headers.get('location'), body: null };
  }
  if (!res.ok) return { status: res.status, redirect: null, body: null };
  return { status: res.status, redirect: null, body: (await res.json()) as { total_count: number; data: Record<string, unknown>[] } };
}

async function probeEpisode(seriesId: number, seriesImdb: string | null, season: number, episode: number) {
  const ep = await tmdb<TmdbEpisode>(`/tv/${seriesId}/season/${season}/episode/${episode}?language=en-US&append_to_response=external_ids`);
  const episodeKey = `tmdb-${seriesId}-s${String(season).padStart(2, '0')}-e${String(episode).padStart(2, '0')}`;
  console.log(`\n${episodeKey}: "${ep.name}" (TMDB ${ep.id}, IMDb ${ep.external_ids?.imdb_id ?? '—'}, ${ep.runtime ?? '?'} min)`);

  const common = { ai_translated: 'exclude', foreign_parts_only: 'exclude', languages: 'en' };
  const strategies: [string, Record<string, string | number | undefined> | null][] = [
    ['E1', { ...common, parent_tmdb_id: seriesId, season_number: season, episode_number: episode }],
    ['E2', ep.external_ids?.imdb_id ? { ...common, imdb_id: ep.external_ids.imdb_id } : null],
    ['E3', { ...common, tmdb_id: ep.id }],
    ['E4', seriesImdb ? { ...common, parent_imdb_id: seriesImdb, season_number: season, episode_number: episode } : null],
    ['E5', { ...common, query: args.query, season_number: season, episode_number: episode, type: 'episode' }],
  ];

  const dir = path.join(FIXTURES_DIR, episodeKey);
  mkdirSync(dir, { recursive: true });
  const summary: Record<string, unknown> = { episodeKey, tmdbEpisodeName: ep.name, tmdbEpisodeId: ep.id, runtime: ep.runtime };

  for (const [name, params] of strategies) {
    if (!params) {
      console.log(`  ${name}: pulada (falta o ID necessário)`);
      continue;
    }
    const query = buildSubtitleQuery(params);
    const result = await searchSubtitles(query);
    await sleep(400);

    if (result.redirect) {
      console.log(`  ${name}: HTTP ${result.status} → redirect para ${result.redirect} (parâmetro fora do padrão?)`);
      summary[name] = { status: result.status, redirect: result.redirect, query };
      continue;
    }
    if (!result.body) {
      console.log(`  ${name}: HTTP ${result.status}`);
      summary[name] = { status: result.status, query };
      continue;
    }

    const items = result.body.data.map(anonymize);
    const titles = items.slice(0, 3).map((i) => {
      const fd = (i.attributes as { feature_details?: { title?: string; season_number?: number; episode_number?: number } }).feature_details;
      return `${fd?.title ?? '?'} (S${fd?.season_number ?? '?'}E${fd?.episode_number ?? '?'})`;
    });
    console.log(`  ${name}: ${result.body.total_count} resultado(s)${titles.length ? ` — ${titles.join(' | ')}` : ''}`);
    writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ query, ...result.body, data: items }, null, 2) + '\n');
    summary[name] = { status: result.status, query, totalCount: result.body.total_count };
    if (items[0]) summary.featureDetailsShape = typeShape((items[0].attributes as Record<string, unknown>).feature_details);
  }

  writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
}

async function probeLogin() {
  const res = await fetch(`${OS_BASE}/login`, {
    method: 'POST',
    headers: { 'Api-Key': osApiKey, 'User-Agent': userAgent, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: requireEnv('OPENSUBTITLES_USERNAME'), password: requireEnv('OPENSUBTITLES_PASSWORD') }),
    signal: AbortSignal.timeout(10000),
  });
  const body = res.ok ? await res.json() : null;
  // Só nomes e tipos: token e dados da conta nunca vão para o disco
  const shape = { status: res.status, body: typeShape(body) };
  writeFileSync(path.join(FIXTURES_DIR, 'login.shape.json'), JSON.stringify(shape, null, 2) + '\n');
  console.log(`\n/login: HTTP ${res.status}; formato salvo em ${path.join(FIXTURES_DIR, 'login.shape.json')}`);
}

const seriesId = await resolveSeriesId();
const series = await tmdb<TmdbSeries>(`/tv/${seriesId}?language=en-US&append_to_response=external_ids`);
// `||`: variáveis vazias do .env contam como ausentes
const season = Number(args.season || process.env.TRACER_SEASON || 1);
const episodes = (args.episodes || process.env.TRACER_EPISODE || '1,4').split(',').map(Number);

mkdirSync(FIXTURES_DIR, { recursive: true });
for (const episode of episodes) {
  await probeEpisode(seriesId, series.external_ids?.imdb_id ?? null, season, episode);
}
if (args.login) await probeLogin();
console.log(`\nFixtures em ${FIXTURES_DIR}/ (só metadados; uploaders anonimizados).`);
