// Falha o build se algo que chega ao navegador contiver segredo (docs/10 F0, NFR-05).
// Varre os chunks de .next/static e as respostas pré-renderizadas de .next/server/app (HTML, RSC, corpos de rotas).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Variáveis cujo valor nunca pode aparecer no que o navegador recebe
export const SECRET_ENV_VARS = [
  'TMDB_READ_TOKEN',
  'OPENSUBTITLES_API_KEY',
  'OPENSUBTITLES_PASSWORD',
  'ANTHROPIC_API_KEY',
  'TOKEN_ENCRYPTION_KEY',
  'ADMIN_TOKEN',
  'IP_HASH_SALT',
  'GENERATION_ACCESS_CODE',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'SUBDL_API_KEY',
];

export const SECRET_PATTERNS = [
  { name: 'chave da Anthropic (sk-ant-)', regex: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { name: 'token JWT', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'chave privada PEM', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'URL de banco com senha', regex: /postgres(?:ql)?:\/\/[^\s:/'"`]+:[^\s@'"`]+@/ },
];

// Valores curtos ou placeholders dariam falso positivo
const MIN_SECRET_LENGTH = 8;

/** Devolve o que foi encontrado no conteúdo, sem expor o valor do segredo. */
export function findSecrets(content, secretValues) {
  const findings = [];
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) findings.push(name);
  }
  for (const [key, value] of Object.entries(secretValues)) {
    if (value && value.length >= MIN_SECRET_LENGTH && !value.startsWith('pglite://') && content.includes(value)) {
      findings.push(`valor de ${key}`);
    }
  }
  return findings;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function publicFiles(nextDir) {
  const files = [];
  const staticDir = path.join(nextDir, 'static');
  if (existsSync(staticDir)) files.push(...walk(staticDir));
  // Em server/app, o JS fica no servidor; o resto (html, rsc, body, meta) é servido como está
  for (const sub of ['server/app', 'server/pages']) {
    const dir = path.join(nextDir, sub);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      if (!/\.(js|map|nft\.json)$/.test(file)) files.push(file);
    }
  }
  return files;
}

function loadLocalEnv() {
  // Script roda fora do Next: carrega os mesmos arquivos que o build usou
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

function main() {
  const nextDir = path.join(process.cwd(), '.next');
  if (!existsSync(path.join(nextDir, 'static'))) {
    console.error('check-bundle: .next/static não existe. Rode `next build` antes.');
    process.exit(1);
  }

  loadLocalEnv();
  const secretValues = Object.fromEntries(SECRET_ENV_VARS.map((key) => [key, process.env[key]]));

  const files = publicFiles(nextDir);
  let problems = 0;
  for (const file of files) {
    const findings = findSecrets(readFileSync(file, 'utf8'), secretValues);
    for (const finding of findings) {
      problems++;
      console.error(`check-bundle: ${finding} em ${path.relative(process.cwd(), file)}`);
    }
  }

  if (problems > 0) {
    console.error(`check-bundle: ${problems} ocorrência(s) de segredo no que vai para o navegador. Build reprovado.`);
    process.exit(1);
  }
  console.log(`check-bundle: ${files.length} arquivos públicos verificados, nenhum segredo encontrado.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
