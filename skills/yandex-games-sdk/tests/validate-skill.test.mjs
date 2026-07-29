import { it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..');

it('reports a clean validation result when the package has no findings', () => {
  const output = execFileSync(
    process.execPath,
    [join(skillDir, 'scripts', 'validate-skill.mjs')],
    { cwd: skillDir, encoding: 'utf-8' },
  );

  assert.match(output, /All checks passed/);
  assert.doesNotMatch(output, /PASS WITH WARNINGS/);
  assert.doesNotMatch(output, /deprecated-api\.md: missing Source annotation/);
  assert.doesNotMatch(output, /official-sources\.md: missing Source annotation/);
  assert.doesNotMatch(output, /troubleshooting\.md: missing Source annotation/);
});

it('supports a strict mode that succeeds for a clean package', () => {
  const result = spawnSync(
    process.execPath,
    [join(skillDir, 'scripts', 'validate-skill.mjs'), '--strict'],
    { cwd: skillDir, encoding: 'utf-8' },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /All checks passed/);
});

it('strict mode fails when a copied package contains a warning', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'yandex-skill-validation-'));
  const copiedSkillDir = join(tempRoot, 'yandex-games-sdk');
  const unreferencedFixture = ['unreferenced', 'fixture'].join('-');
  cpSync(skillDir, copiedSkillDir, { recursive: true });
  mkdirSync(
    join(copiedSkillDir, 'tests', 'fixtures', unreferencedFixture),
    { recursive: true },
  );

  const result = spawnSync(
    process.execPath,
    [join(copiedSkillDir, 'scripts', 'validate-skill.mjs'), '--strict'],
    { cwd: copiedSkillDir, encoding: 'utf-8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL \(warnings treated as errors\)/);
  assert.match(result.stdout, new RegExp(unreferencedFixture));
});
