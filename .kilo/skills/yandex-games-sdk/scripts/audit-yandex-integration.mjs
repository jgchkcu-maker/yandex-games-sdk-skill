#!/usr/bin/env node
/**
 * Yandex Games SDK Integration Auditor
 *
 * Analyzes a game project for Yandex SDK integration compliance.
 *
 * Usage:
 *   node audit-yandex-integration.mjs <project-dir> [--json] [--exclude-fixtures]
 *
 * Exit codes:
 *   0 - No critical FAIL issues
 *   1 - Critical FAIL issues found
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { dirname, extname, join, relative } from 'path';

const RULES = {
  'YG-SDK-001': { level: 'FAIL', desc: 'SDK script not found in any HTML entry point' },
  'YG-SDK-002': { level: 'FAIL', desc: 'Legacy SDK loader detected (//yandex.ru/games/sdk/v2/)' },
  'YG-SDK-003': { level: 'FAIL', desc: 'YaGames.init() called before SDK script loaded' },
  'YG-SDK-004': { level: 'WARN', desc: 'Multiple YaGames.init() calls detected' },
  'YG-SDK-005': { level: 'MANUAL', desc: 'Game Ready (LoadingAPI.ready()) not found' },
  'YG-SDK-006': { level: 'MANUAL', desc: 'GameplayAPI.start() without matching stop()' },
  'YG-SDK-007': { level: 'FAIL', desc: 'Rewarded reward given in onClose instead of onRewarded' },
  'YG-SDK-008': { level: 'FAIL', desc: 'Deprecated leaderboard API used (getLeaderboards())' },
  'YG-SDK-009': { level: 'FAIL', desc: 'Deprecated player method used (getID, getMode)' },
  'YG-SDK-010': { level: 'FAIL', desc: 'Mock SDK imported in production code' },
  'YG-SDK-011': { level: 'FAIL', desc: 'External payment system detected (not Yandex SDK)' },
  'YG-SDK-012': { level: 'FAIL', desc: 'Auth dialog opened on page start' },
  'YG-SDK-013': { level: 'WARN', desc: 'Ad showFullscreenAdv inside setInterval' },
  'YG-SDK-014': { level: 'WARN', desc: 'Save call near game loop' },
  'YG-SDK-015': { level: 'FAIL', desc: 'Secrets or API keys found in client code' },
  'YG-SDK-016': { level: 'FAIL', desc: 'Eval or unsafe code detected' },
  'YG-SDK-017': { level: 'FAIL', desc: 'Absolute URLs to Yandex S3 for game resources' },
  'YG-SDK-018': { level: 'FAIL', desc: 'No index.html in project root' },
  'YG-SDK-019': { level: 'FAIL', desc: 'Spaces or cyrillic characters in file paths' },
  'YG-SDK-020': { level: 'MANUAL', desc: 'Archive size may exceed 100 MB' },
  'YG-SDK-021': { level: 'FAIL', desc: 'YaGames.init() without error handling' },
  'YG-SDK-022': { level: 'FAIL', desc: 'Mock fallback in production code' },
};

function getEntryHtmlFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isFile() && entry === 'index.html') files.push(full);
    }
  } catch {}
  return files;
}

function getAllProjectFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  function walk(p) {
    try {
      const entries = readdirSync(p);
      for (const entry of entries) {
        if (entry === '.' || entry === '..' || entry === 'node_modules') continue;
        const full = join(p, entry);
        try {
          if (statSync(full).isDirectory()) walk(full);
          else files.push(full);
        } catch {}
      }
    } catch {}
  }
  walk(dir);
  return files;
}

function isTestOrFixture(f, dir) {
  const rel = f.replace(dir, '');
  return /[/\\]tests?[/\\]/.test(rel) || /[/\\]fixtures?[/\\]/.test(rel) || /\.test\./.test(rel) || /\.spec\./.test(rel);
}

function readFileSafe(p) {
  try { return readFileSync(p, 'utf-8'); } catch { return ''; }
}

function isOfficialSdkSource(src) {
  const cleanSrc = src.split(/[?#]/, 1)[0];
  return cleanSrc === '/sdk.js' || cleanSrc === 'https://sdk.games.s3.yandex.net/sdk.js';
}

function resolveLocalScript(projectDir, htmlFile, src) {
  const cleanSrc = src.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  if (!cleanSrc || /^(?:https?:)?\/\//i.test(cleanSrc) || /^(?:data|blob):/i.test(cleanSrc)) {
    return null;
  }
  return cleanSrc.startsWith('/')
    ? join(projectDir, cleanSrc.slice(1))
    : join(dirname(htmlFile), cleanSrc);
}

function findInitializationOrderIssues(projectDir, htmlFiles) {
  const issues = [];
  for (const htmlFile of htmlFiles) {
    const content = readFileSafe(htmlFile);
    const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    const deferredScripts = [];
    let synchronousSdkSeen = false;
    let issueFound = false;
    let match;

    function executeScript(script) {
      if (script.isSdk) {
        synchronousSdkSeen = true;
        return;
      }
      if (!synchronousSdkSeen && script.hasInit) {
        issues.push({
          rule: 'YG-SDK-003',
          level: 'FAIL',
          file: htmlFile,
          line: script.line,
          message: `YaGames.init() can execute before the SDK script${script.src ? ` via ${script.src}` : ''}.`,
        });
        issueFound = true;
      }
    }

    while ((match = scriptPattern.exec(content)) !== null) {
      const attributes = match[1];
      const inlineSource = match[2];
      const srcMatch = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const src = srcMatch?.[1] ?? '';
      const line = content.slice(0, match.index).split('\n').length;

      let executableSource = inlineSource;
      if (src) {
        const localScript = resolveLocalScript(projectDir, htmlFile, src);
        executableSource = localScript ? readFileSafe(localScript) : '';
      }

      const script = {
        src,
        line,
        isSdk: isOfficialSdkSource(src),
        hasInit: /YaGames\.init\s*\(/.test(executableSource),
      };
      const isExternal = Boolean(src);
      const isModule = /\btype\s*=\s*["']module["']/i.test(attributes);
      const hasAsync = /\basync(?:\s|=|$)/i.test(attributes);
      const isAsync = hasAsync && (isExternal || isModule);
      const isDeferred = !isAsync && (
        (isExternal && /\bdefer(?:\s|=|$)/i.test(attributes)) ||
        isModule
      );

      if (isAsync) {
        // Async SDK loading never guarantees readiness for a later script.
        if (!script.isSdk) executeScript(script);
      } else if (isDeferred) {
        deferredScripts.push(script);
      } else {
        executeScript(script);
      }

      if (issueFound) break;
    }

    if (!issueFound) {
      // Deferred scripts execute after parsing, in document order. Any
      // synchronous SDK tag in the document has completed by this point.
      for (const script of deferredScripts) {
        executeScript(script);
        if (issueFound) break;
      }
    }
  }
  return issues;
}

function getDirSize(dir) {
  let size = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) size += getDirSize(full);
      else if (e.isFile()) size += statSync(full).size;
    }
  } catch {}
  return size;
}

function braceDelta(line) {
  let delta = 0;
  for (const character of line) {
    if (character === '{') delta++;
    else if (character === '}') delta--;
  }
  return delta;
}

function isInsideHandledTryBlock(lines, lineIndex) {
  for (let start = lineIndex; start >= 0; start--) {
    if (!/\btry\s*\{/.test(lines[start])) continue;

    let depth = 0;
    for (let i = start; i <= lineIndex; i++) depth += braceDelta(lines[i]);
    if (depth <= 0) continue;

    for (let i = lineIndex + 1; i < lines.length; i++) {
      if (depth === 1 && /}\s*catch\s*(?:\([^)]*\))?\s*\{/.test(lines.slice(i, i + 2).join('\n'))) {
        return true;
      }
      depth += braceDelta(lines[i]);
      if (depth <= 0) {
        return /}\s*catch\s*(?:\([^)]*\))?\s*\{/.test(lines.slice(i, i + 2).join('\n'));
      }
    }
  }
  return false;
}

export function auditProject(dir, options = {}) {
  const { jsonOutput = false, excludeFixtures = true } = options;
  const results = [];
  const entryHtmlFiles = getEntryHtmlFiles(dir);

  if (entryHtmlFiles.length === 0) {
    results.push({ rule: 'YG-SDK-018', level: 'FAIL', file: dir + '/index.html', line: 0, message: 'No index.html found in project root.' });
  }

  let allProjectFiles = getAllProjectFiles(dir);
  if (excludeFixtures) {
    allProjectFiles = allProjectFiles.filter(f => !isTestOrFixture(f, dir));
  }
  let allSources = allProjectFiles.filter(file =>
    ['.html', '.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(extname(file)),
  );
  const filesToCheck = [...entryHtmlFiles, ...allSources.filter(f => !entryHtmlFiles.includes(f))];

  const sdkFound = entryHtmlFiles.some(file =>
    /<script\b[^>]*\bsrc\s*=\s*["'](?:\/sdk\.js|https:\/\/sdk\.games\.s3\.yandex\.net\/sdk\.js)(?:[?#][^"']*)?["'][^>]*>/i
      .test(readFileSafe(file)),
  );
  let initPositions = [];
  let gameReadyFound = false;
  let gameplayStartCount = 0;
  let gameplayStopCount = 0;

  function extractCallbackBody(callBlock, callbackName) {
    const callbackPattern = new RegExp(
      `${callbackName}\\s*:\\s*(?:async\\s*)?(?:(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>|function\\s*\\([^)]*\\))\\s*`,
    );
    const callbackMatch = callbackPattern.exec(callBlock);
    if (!callbackMatch) return null;

    const bodyStart = callbackMatch.index + callbackMatch[0].length;
    if (callBlock[bodyStart] !== '{') {
      const expression = callBlock.slice(bodyStart).match(/^([^,\n}]+)/)?.[1] ?? '';
      return { body: expression, start: bodyStart };
    }

    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = bodyStart; index < callBlock.length; index++) {
      const character = callBlock[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
        continue;
      }
      if (character === '{') depth++;
      else if (character === '}') {
        depth--;
        if (depth === 0) {
          return { body: callBlock.slice(bodyStart + 1, index), start: bodyStart + 1 };
        }
      }
    }
    return null;
  }

  function checkRewardedInOnClose(lines, startLine) {
    // Find the opening { after showRewardedVideo(
    let braceDepth = 0;
    let foundOpen = false;
    let i = startLine;
    for (; i < lines.length; i++) {
      const line = lines[i];
      // Count braces ignoring strings
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '{') { braceDepth++; foundOpen = true; }
        else if (line[c] === '}') { braceDepth--; }
      }
      if (foundOpen && braceDepth === 0) break;
    }
    const callBlock = lines.slice(startLine, i + 1).join('\n');
    const onClose = extractCallbackBody(callBlock, 'onClose');
    if (!onClose) return null;
    const suspiciousRewardEffect =
      /reward|give|grant|award|prize|bonus|coins?|currency|wallet|balance|inventory|unlock|credit|setData|setStats/i;
    if (suspiciousRewardEffect.test(onClose.body)) {
      return {
        line: startLine + callBlock.slice(0, onClose.start).split('\n').length,
      };
    }
    return null;
  }

  results.push(...findInitializationOrderIssues(dir, entryHtmlFiles));

  for (const file of filesToCheck) {
    const content = readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');
    let inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (/\/\*/.test(line)) inBlockComment = true;
      if (inBlockComment) { if (/\*\//.test(line)) inBlockComment = false; continue; }
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('<!--')) continue;

      // YG-SDK-002: Legacy loader
      if (/yandex\.ru\/games\/sdk\/v2\//.test(line)) {
        results.push({ rule: 'YG-SDK-002', level: 'FAIL', file, line: lineNum, message: 'Legacy SDK loader detected. Use /sdk.js instead.' });
      }

      // YG-SDK-003/021: Init calls
      if (/YaGames\.init/.test(line)) {
        initPositions.push({ file, line: lineNum });
        const callContext = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
        if (!/YaGames\.init[\s\S]*?\.catch\s*\(/.test(callContext) && !isInsideHandledTryBlock(lines, i)) {
          results.push({ rule: 'YG-SDK-021', level: 'FAIL', file, line: lineNum, message: 'YaGames.init() without error handling (.catch() or try/catch).' });
        }
      }

      // YG-SDK-005: Game Ready
      if (/LoadingAPI\??\.ready\s*\(/.test(line)) gameReadyFound = true;

      // YG-SDK-006: Gameplay API — count balanced start/stop calls
      if (/GameplayAPI\??\.start\s*\(/.test(line)) gameplayStartCount++;
      if (/GameplayAPI\??\.stop\s*\(/.test(line)) gameplayStopCount++;

      // YG-SDK-007: Reward-like side effects inside the onClose callback body
      if (/showRewardedVideo\s*\(/.test(line)) {
        const result = checkRewardedInOnClose(lines, i);
        if (result) {
          results.push({ rule: 'YG-SDK-007', level: 'FAIL', file, line: result.line, message: 'Reward granted in onClose. Reward MUST only be in onRewarded callback.' });
        }
      }

      // YG-SDK-008: Deprecated leaderboard
      if (/getLeaderboards\s*\(/.test(line)) {
        results.push({ rule: 'YG-SDK-008', level: 'FAIL', file, line: lineNum, message: 'getLeaderboards() deprecated. Use ysdk.leaderboards.* directly.' });
      }
      if (/\.getLeaderboardDescription\s*\(/.test(line) || /\.setLeaderboardScore\s*\(/.test(line) || /\.getLeaderboardPlayerEntry\s*\(/.test(line) || /\.getLeaderboardEntries\s*\(/.test(line)) {
        results.push({ rule: 'YG-SDK-008', level: 'FAIL', file, line: lineNum, message: 'Deprecated leaderboard method. Use ysdk.leaderboards.*' });
      }

      // YG-SDK-009: Deprecated player
      if (/player\.getID\s*\(/.test(line) && !/getUniqueID/.test(line)) {
        results.push({ rule: 'YG-SDK-009', level: 'FAIL', file, line: lineNum, message: 'player.getID() deprecated. Use player.getUniqueID().' });
      }
      if (/player\.getMode\s*\(/.test(line)) {
        results.push({ rule: 'YG-SDK-009', level: 'FAIL', file, line: lineNum, message: 'player.getMode() deprecated. Use player.isAuthorized().' });
      }

      // YG-SDK-010: Mock in production
      if (/(mock.*yandex|mockSDK|MockYandex|createMockSDK)/i.test(line) && !isTestOrFixture(file, dir)) {
        results.push({ rule: 'YG-SDK-010', level: 'FAIL', file, line: lineNum, message: 'Mock SDK detected in production code.' });
      }

      // YG-SDK-011: External payments
      if (/(stripe|paypal|yoomoney|qiwi|robokassa|tinkoff)/i.test(line) && /purchase|payment|pay|checkout/i.test(line)) {
        results.push({ rule: 'YG-SDK-011', level: 'FAIL', file, line: lineNum, message: 'External payment system detected. Only Yandex SDK IAP allowed.' });
      }

      // YG-SDK-012: Auth on start
      if (/openAuthDialog/.test(line)) {
        const ctx = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (/addEventListener\s*\(['"]load['"]/.test(ctx) || /window\.onload/.test(ctx) || /DOMContentLoaded/.test(ctx)) {
          results.push({ rule: 'YG-SDK-012', level: 'FAIL', file, line: lineNum, message: 'Auth dialog potentially opened on page start. Only after user action.' });
        }
      }

      // YG-SDK-013: setInterval ad
      if (/setInterval/.test(line) && /showFullscreenAdv|showRewardedVideo/.test(line)) {
        results.push({ rule: 'YG-SDK-013', level: 'WARN', file, line: lineNum, message: 'Ad call inside setInterval. Platform manages ad frequency.' });
      }

      // YG-SDK-014: Save in loop
      if (/(setData|setStats)/.test(line) && /requestAnimationFrame/.test(content)) {
        results.push({ rule: 'YG-SDK-014', level: 'WARN', file, line: lineNum, message: 'Save call near game loop. Debounce saves.' });
      }

      // YG-SDK-015: Secrets
      if (/(secret|api[_-]?key|private[_-]?key).*['"][A-Za-z0-9_\-]{16,}['"]/i.test(line) && !/example|sample|placeholder/i.test(line)) {
        results.push({ rule: 'YG-SDK-015', level: 'FAIL', file, line: lineNum, message: 'Potential secret in client code.' });
      }

      // YG-SDK-016: Eval
      if (/\beval\s*\(/.test(line)) {
        results.push({ rule: 'YG-SDK-016', level: 'FAIL', file, line: lineNum, message: 'eval() detected.' });
      }

      // YG-SDK-017: S3 resource URLs
      let s3Match = line.match(/https?:\/\/[^'"\s`>]+\.s3\.yandex\.net[^'"\s`>]*/);
      if (s3Match && !s3Match[0].includes('sdk.games.s3.yandex.net')) {
        results.push({ rule: 'YG-SDK-017', level: 'FAIL', file, line: lineNum, message: 'Absolute S3 URL for resources: ' + s3Match[0] });
      }

      // YG-SDK-022: Mock fallback in production
      if (/(typeof\s+YaGames\s*===\s*['"]undefined['"]|!ysdk)/.test(line)) {
        const block = lines.slice(i, Math.min(i + 6, lines.length)).join('\n');
        if (/createMock|new\s+Mock|ysdk\s*=\s*\{/.test(block)) {
          results.push({ rule: 'YG-SDK-022', level: 'FAIL', file, line: lineNum, message: 'SDK mock fallback in production. Log error, do not fake SDK.' });
        }
      }
    }
  }

  if (!sdkFound) {
    results.push({ rule: 'YG-SDK-001', level: 'FAIL', file: dir, line: 0, message: 'SDK script not found. Add <script src="/sdk.js"> for archive or S3 URL for own domain.' });
  }

  if (initPositions.length > 1) {
    results.push({ rule: 'YG-SDK-004', level: 'WARN', file: initPositions[1].file, line: initPositions[1].line, message: 'Possible multiple YaGames.init(). Use singleton pattern.' });
  }

  if (!gameReadyFound) {
    results.push({ rule: 'YG-SDK-005', level: 'MANUAL', file: dir, line: 0, message: 'Game Ready (LoadingAPI.ready()) not found (req 1.19.2).' });
  }

  // YG-SDK-006: Find unmatched GameplayAPI calls (start != stop in either direction)
  if (gameplayStartCount > 0 || gameplayStopCount > 0) {
    if (gameplayStartCount !== gameplayStopCount) {
      results.push({ rule: 'YG-SDK-006', level: 'WARN', file: dir, line: 0, message: `GameplayAPI calls mismatch: ${gameplayStartCount} start(s) vs ${gameplayStopCount} stop(s). Expected equal count.` });
    }
  }

  // YG-SDK-019
  for (const f of allProjectFiles) {
    const rel = relative(dir, f);
    if (/[\u0400-\u04FF]/.test(rel) || /\s/.test(rel)) {
      results.push({ rule: 'YG-SDK-019', level: 'FAIL', file: f, line: 0, message: 'File path has spaces or cyrillic.' });
      break;
    }
  }

  // YG-SDK-020: Check build output size (< 100 MB)
  // The passed directory IS the directory to analyze — do NOT look for dist/ inside it
  if (existsSync(dir)) {
    try {
      const size = getDirSize(dir);
      if (size > 100 * 1024 * 1024) {
        results.push({ rule: 'YG-SDK-020', level: 'MANUAL', file: dir, line: 0, message: `Build size ${(size/1024/1024).toFixed(1)} MB exceeds 100 MB limit.` });
      }
    } catch {}
  }

  results.sort((a, b) => {
    const order = { FAIL: 0, WARN: 1, MANUAL: 2 };
    return (order[a.level] ?? 99) - (order[b.level] ?? 99);
  });

  return results;
}

function printHuman(results) {
  const counts = { FAIL: 0, WARN: 0, MANUAL: 0, PASS: 0 };
  console.log('\n=== Yandex Games SDK Audit ===\n');
  for (const r of results) {
    counts[r.level] = (counts[r.level] ?? 0) + 1;
    const icon = r.level === 'FAIL' ? '[FAIL]' : r.level === 'WARN' ? '[WARN]' : '[MANUAL]';
    console.log(`${icon} ${r.rule} ${r.message}`);
    if (r.file) console.log(`   File: ${r.file}${r.line > 0 ? ':' + r.line : ''}`);
    console.log();
  }
  console.log('--- Summary ---');
  console.log('FAIL:  ' + counts.FAIL);
  console.log('WARN:  ' + counts.WARN);
  console.log('MANUAL: ' + counts.MANUAL);
  console.log('');
  if (counts.FAIL > 0) {
    console.log('FAIL items found. Fix before moderation submission.');
  } else {
    console.log('No critical FAIL issues detected.');
  }
  console.log('Static audit does not guarantee passing moderation.');
  console.log('Always verify with debug panel and draft testing.\n');
}

function printJson(results) {
  const summary = { fail: 0, warn: 0, manual: 0, pass: 0 };
  for (const r of results) {
    if (r.level === 'FAIL') summary.fail++;
    else if (r.level === 'WARN') summary.warn++;
    else if (r.level === 'MANUAL') summary.manual++;
    else summary.pass++;
  }
  const output = { summary, results, timestamp: new Date().toISOString() };
  console.log(JSON.stringify(output, null, 2));
}

// CLI entry point - only runs when executed directly
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('audit-yandex-integration.mjs') || process.argv[1].endsWith('audit-yandex-integration'));
if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node audit-yandex-integration.mjs <project-dir> [--json] [--no-exclude-fixtures]');
    process.exit(1);
  }

  const projectDir = args[0];
  const useJson = args.includes('--json');
  const excludeFixtures = !args.includes('--no-exclude-fixtures');

  if (!existsSync(projectDir)) {
    console.error('Directory not found: ' + projectDir);
    process.exit(1);
  }

  const results = auditProject(projectDir, { jsonOutput: useJson, excludeFixtures });

  if (useJson) {
    printJson(results);
  } else {
    printHuman(results);
  }

  const hasFail = results.some(r => r.level === 'FAIL');
  process.exit(hasFail ? 1 : 0);
}
