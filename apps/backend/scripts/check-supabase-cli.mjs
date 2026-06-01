/**
 * Compares .env project ref with `supabase projects list` (no secrets logged).
 * Run from apps/backend: node scripts/check-supabase-cli.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const repoRoot = resolve(backendRoot, '../..');
const logPath = resolve(repoRoot, 'debug-3a6058.log');

config({ path: resolve(backendRoot, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const envRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
const envProjectRef = envRefMatch?.[1] ?? '(not set)';

let cliRefs = [];
try {
  const out = execSync('supabase projects list', {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // Table columns: LINKED | ORG ID | REFERENCE ID | NAME | ...
  cliRefs = [...out.matchAll(/\|\s+[a-z0-9]+\s+\|\s+([a-z0-9]{20})\s+\|/gi)].map(
    (m) => m[1],
  );
} catch (e) {
  console.error('Could not run supabase projects list. Run: supabase login');
  process.exit(1);
}

const linkedRefPath = resolve(repoRoot, 'supabase/.temp/project-ref');
const repoLinkedRef = existsSync(linkedRefPath)
  ? readFileSync(linkedRefPath, 'utf8').trim()
  : null;

const cliHasEnvRef = cliRefs.includes(envProjectRef);
const envMatchesRepoLink = repoLinkedRef === envProjectRef;
const payload = {
  envProjectRef,
  repoLinkedRef,
  cliAccessibleRefs: cliRefs,
  cliCanLinkEnvProject: cliHasEnvRef,
  envMatchesRepoLink,
};

appendFileSync(
  logPath,
  JSON.stringify({
    sessionId: '3a6058',
    runId: 'supabase-cli-check',
    hypothesisId: 'H-ACL',
    location: 'scripts/check-supabase-cli.mjs',
    message: 'Supabase CLI vs .env project ref',
    data: payload,
    timestamp: Date.now(),
  }) + '\n',
);

console.log('--- Supabase CLI access check ---');
console.log('Project in .env (NEXT_PUBLIC_SUPABASE_URL):', envProjectRef);
console.log('Repo linked via CLI (supabase/.temp/project-ref):', repoLinkedRef ?? '(not linked)');
console.log('Projects your CLI login can access:', cliRefs.join(', ') || '(none)');
if (repoLinkedRef && !envMatchesRepoLink) {
  console.log('');
  console.log('NOTE: Repo is linked to', repoLinkedRef, 'but .env points at', envProjectRef + '.');
  console.log('Supabase CLI commands apply to the linked repo project, not .env automatically.');
}
if (cliHasEnvRef) {
  console.log('OK: supabase link should work for your .env project.');
} else {
  console.log('');
  console.log('BLOCKED: supabase link will fail for', envProjectRef);
  console.log('Your CLI is logged into a different Supabase account than this project.');
  console.log('');
  console.log('Fix options:');
  console.log('  1. supabase logout && supabase login (use the account that owns', envProjectRef + ')');
  console.log('  2. Or set SUPABASE_ACCESS_TOKEN from that account, then supabase link');
  console.log('  3. Or skip CLI: use Dashboard → SQL Editor for RLS (apps/backend/prisma/rls-policies.sql)');
  console.log('  4. Or use your owned project ref:', cliRefs[0] ?? 'n/a', 'and update .env connection strings');
}

process.exit(cliHasEnvRef ? 0 : 1);
