#!/usr/bin/env node
/**
 * Validate the Yandex Games SDK skill package.
 *
 * Performs deep analysis:
 * - File existence and non-empty
 * - SKILL.md frontmatter correctness
 * - Legacy loader usage (only in deprecated files)
 * - Verification date consistency
 * - Reference URL format and consistency
 * - Adapter internal consistency (methods match across adapters)
 * - Mock SDK compatibility with @types/ysdk shapes
 * - All test fixtures reference valid rules
 * - All audit rules have corresponding test coverage
 * - No console.log (only console.warn/error) in production adapter code
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILL_DIR = join(__dirname, '..');

const REQUIRED_FILES = [
  'SKILL.md', 'README.md', 'CHANGELOG.md',
  'references/official-sources.md', 'references/integration-workflow.md',
  'references/initialization-and-lifecycle.md', 'references/advertising.md',
  'references/events-pause-and-audio.md', 'references/player-auth-and-storage.md',
  'references/leaderboards.md', 'references/purchases.md', 'references/remote-config.md',
  'references/localization-and-environment.md', 'references/server-time-and-device.md',
  'references/local-testing.md', 'references/moderation-requirements.md',
  'references/moderation-checklist.md', 'references/deprecated-api.md', 'references/troubleshooting.md',
  'assets/vanilla-js-adapter.js', 'assets/typescript-adapter.ts', 'assets/phaser-adapter.ts',
  'assets/mock-yandex-sdk.ts', 'assets/example-yandex-hosted.html', 'assets/example-own-domain.html',
  'scripts/audit-yandex-integration.mjs', 'scripts/validate-skill.mjs',
  'tests/audit-yandex-integration.test.mjs', 'tests/adapters.test.mjs',
  'tests/validate-skill.test.mjs',
];

const ADAPTER_METHODS = [
  'init', 'gameReady', 'gameplayStart', 'gameplayStop',
  'addPause', 'removePause', 'showFullscreenAd', 'showRewardedAd',
  'getPlayer', 'getFlags', 'destroy', 'getBannerAdvStatus',
  'showBannerAdv', 'hideBannerAdv', 'getPayments', 'getStorage',
  'serverTime', 'onPause', 'onResume', 'setMuted',
];

const ALL_RULES = [
  'YG-SDK-001', 'YG-SDK-002', 'YG-SDK-003', 'YG-SDK-004',
  'YG-SDK-005', 'YG-SDK-006', 'YG-SDK-007', 'YG-SDK-008',
  'YG-SDK-009', 'YG-SDK-010', 'YG-SDK-011', 'YG-SDK-012',
  'YG-SDK-013', 'YG-SDK-014', 'YG-SDK-015', 'YG-SDK-016',
  'YG-SDK-017', 'YG-SDK-018', 'YG-SDK-019', 'YG-SDK-020',
  'YG-SDK-021', 'YG-SDK-022',
];

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function fileExists(relPath) {
  const full = join(SKILL_DIR, relPath);
  if (!existsSync(full)) { err('Missing: ' + relPath); return false; }
  if (statSync(full).size === 0) err('Empty file: ' + relPath);
  return true;
}

function readFile(relPath) {
  try { return readFileSync(join(SKILL_DIR, relPath), 'utf-8'); } catch { return ''; }
}

// === Phase 1: Required file existence ===
for (const f of REQUIRED_FILES) fileExists(f);

// === Phase 2: SKILL.md frontmatter ===
const skillContent = readFile('SKILL.md');
const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) { err('SKILL.md missing YAML frontmatter'); }
else {
  const fm = fmMatch[1];
  if (!fm.includes('name: yandex-games-sdk')) err('SKILL.md: name field missing or wrong');
  if (!fm.includes('description:')) err('SKILL.md: description field missing');
  if (!fm.includes('version:')) err('SKILL.md: version field missing');
  if (!fm.includes('verified: 2026-07-29')) err('SKILL.md: verified date missing or wrong');

  // Check version format
  const versionMatch = fm.match(/version:\s*([\d.]+)/);
  if (versionMatch) {
    const parts = versionMatch[1].split('.');
    if (parts.length !== 3) warn('SKILL.md: version should be semver (x.y.z)');
  }
}

const dirName = SKILL_DIR.split(/[/\\]/).pop();
if (dirName !== 'yandex-games-sdk') err('Directory name mismatch');

// === Phase 3: Reference URL consistency ===
const references = readdirSync(join(SKILL_DIR, 'references'), { withFileTypes: true });
for (const ref of references) {
  if (!ref.isFile() || !ref.name.endsWith('.md')) continue;
  const content = readFile('references/' + ref.name);
  const urlMatch = content.match(/https?:\/\/[^\s)]+/);
  if (urlMatch) {
    const url = urlMatch[0];
    // Verify it's a Yandex Games URL
    if (!url.includes('yandex')) {
      warn(`${ref.name}: non-Yandex URL referenced: ${url}`);
    }
    // Verify source annotation format
    if (!/\bSources?:|\bChecked on|\bsources verified/i.test(content)) {
      warn(`${ref.name}: missing Source annotation`);
    }
  }
  // Check all references have the 2026-07-29 verification date
  if (ref.name !== 'official-sources.md' && !content.includes('2026-07-29')) {
    warn(`${ref.name}: missing verification date 2026-07-29`);
  }
}

// === Phase 4: Legacy loader check ===
const legacySafeFiles = [
  'references/deprecated-api.md', 'references/official-sources.md',
  'references/initialization-and-lifecycle.md', 'references/troubleshooting.md',
  'references/local-testing.md', 'SKILL.md',
  'scripts/audit-yandex-integration.mjs',
  'tests/audit-yandex-integration.test.mjs',
  'tests/fixtures/legacy-loader',
];

const allFiles = [];
function walkDir(p, rel) {
  try {
    const entries = readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = join(p, e.name);
      const relPath = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walkDir(full, relPath);
      else allFiles.push(relPath);
    }
  } catch {}
}
walkDir(SKILL_DIR, '');

for (const f of allFiles) {
  if (!f.endsWith('.js') && !f.endsWith('.ts') && !f.endsWith('.mjs') && !f.endsWith('.html') && !f.endsWith('.md')) continue;
  const content = readFile(f);
  if (content && /yandex\.ru\/games\/sdk\/v2\//.test(content)) {
    const isSafe = legacySafeFiles.some(safe => f.startsWith(safe) || f === safe);
    if (!isSafe) err('Legacy SDK loader found in non-deprecated file: ' + f);
  }
}

// === Phase 5: Adapter code quality ===

// Check vanilla adapter: no console.log
const vanillaSrc = readFile('assets/vanilla-js-adapter.js');
if (vanillaSrc) {
  if (/console\.log\s*\(/.test(vanillaSrc)) {
    warn('vanilla-js-adapter.js: uses console.log (prefer console.warn/error)');
  }
  // Check callbacks: {} wrapper is used
  if (!vanillaSrc.includes('callbacks:')) {
    err('vanilla-js-adapter.js: missing callbacks wrapper for ad methods (@types/ysdk compat)');
  }
  // Check rewardGiven protection
  if (!vanillaSrc.includes('rewardGiven')) {
    err('vanilla-js-adapter.js: missing rewardGiven protection');
  }
  // Check try/catch around ad calls
  if (!vanillaSrc.includes('try {')) {
    err('vanilla-js-adapter.js: missing try/catch around ad methods');
  }
  // Check onPause/onResume cleanup in destroy
  if (!vanillaSrc.includes('onPauseCallbacks = []')) {
    err('vanilla-js-adapter.js: missing onPause callback cleanup in destroy');
  }
}

// Check TS adapter
const tsSrc = readFile('assets/typescript-adapter.ts');
if (tsSrc) {
  if (!tsSrc.includes('callbacks:')) {
    err('typescript-adapter.ts: missing callbacks wrapper for ad methods (@types/ysdk compat)');
  }
  if (!tsSrc.includes('rewardGiven')) {
    err('typescript-adapter.ts: missing rewardGiven protection');
  }
  if (!tsSrc.includes('try {')) {
    err('typescript-adapter.ts: missing try/catch around ad methods');
  }
  if (!tsSrc.includes('onPauseCallbacks_ = []')) {
    err('typescript-adapter.ts: missing onPause callback cleanup in destroy');
  }
  // Check @types/ysdk import
  if (!/import\s+type\s+\{[^}]*\bSDK\b[^}]*\bPlayer\b[^}]*\}\s+from\s+['"]ysdk['"]/.test(tsSrc)) {
    err('typescript-adapter.ts: missing @types/ysdk import');
  }
}

// Check mock SDK supports both callbacks formats
const mockSrc = readFile('assets/mock-yandex-sdk.ts');
if (mockSrc) {
  if (!mockSrc.includes('extractAdCallbacks')) {
    err('mock-yandex-sdk.ts: missing extractAdCallbacks helper for dual format support');
  }
}

// === Phase 6: Method consistency across adapters ===
for (const m of ADAPTER_METHODS) {
  if (vanillaSrc && !vanillaSrc.includes(m)) warn(`vanilla-js-adapter.js missing method: ${m}`);
  if (tsSrc && !tsSrc.includes(m)) warn(`typescript-adapter.ts missing method: ${m}`);
}

// Check phaser adapter core exports
const phaserSrc = readFile('assets/phaser-adapter.ts');
if (phaserSrc) {
  if (!phaserSrc.includes('export function createYandexPhaserAdapter')) {
    err('phaser-adapter.ts: missing createYandexPhaserAdapter export');
  }
  if (!phaserSrc.includes('onSceneChange')) {
    warn('phaser-adapter.ts: missing onSceneChange method');
  }
}

// === Phase 7: Rules and test coverage ===
const auditSrc = readFile('scripts/audit-yandex-integration.mjs');
const testSrc = readFile('tests/audit-yandex-integration.test.mjs');

for (const rule of ALL_RULES) {
  if (!auditSrc.includes(rule)) {
    warn(`Rule ${rule} not found in audit script`);
  }
  if (!testSrc.includes(rule)) {
    warn(`Rule ${rule} not found in audit tests`);
  }
}

// Check test fixture directories match test descriptions
const fixturesDir = join(SKILL_DIR, 'tests', 'fixtures');
if (existsSync(fixturesDir)) {
  const fixtureDirs = readdirSync(fixturesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const fd of fixtureDirs) {
    if (!testSrc.includes(fd)) {
      warn(`Fixture directory 'tests/fixtures/${fd}' not referenced in audit tests`);
    }
  }
}

// === Phase 8: Verification date consistency ===
const sources = readFile('references/official-sources.md');
if (!sources.includes('2026-07-29')) err('references/official-sources.md missing verification date');

const changelog = readFile('CHANGELOG.md');
if (!changelog.includes('2026-07-29')) warn('CHANGELOG.md: missing verification date');

// Check that SKILL.md verified date matches
if (skillContent.includes('verified:') && !skillContent.includes('verified: 2026-07-29')) {
  warn('SKILL.md: verified date does not match today (2026-07-29)');
}

// === Phase 9: Adapter file sizes ===
const adapterFiles = ['vanilla-js-adapter.js', 'typescript-adapter.ts', 'phaser-adapter.ts'];
const ADAPTER_MAX_SIZE = 20000; // 20KB
for (const af of adapterFiles) {
  const full = join(SKILL_DIR, 'assets', af);
  if (existsSync(full)) {
    const size = statSync(full).size;
    if (size > ADAPTER_MAX_SIZE) warn(`${af}: ${size} bytes exceeds ${ADAPTER_MAX_SIZE} bytes — consider splitting`);
  }
}

// === Results ===
const strict = process.argv.includes('--strict');
const totalFindings = errors.length + warnings.length;
console.log(`\n=== Skill Validation (${totalFindings} findings) ===\n`);
if (errors.length === 0 && warnings.length === 0) { console.log('All checks passed.\n'); process.exit(0); }
if (errors.length > 0) { console.log(`Errors (${errors.length}):`); for (const e of errors) console.log('  [ERR] ' + e); console.log(); }
if (warnings.length > 0) { console.log(`Warnings (${warnings.length}):`); for (const w of warnings) console.log('  [WARN] ' + w); console.log(); }
if (errors.length > 0) { console.log('Validation FAILED — fix errors first.\n'); process.exit(1); }
if (strict && warnings.length > 0) {
  console.log('Validation FAIL (warnings treated as errors).\n');
  process.exit(1);
}
console.log('Validation PASS WITH WARNINGS.\n');
process.exit(0);
