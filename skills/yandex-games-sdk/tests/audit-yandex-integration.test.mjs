import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, truncateSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const auditModule = await import('../scripts/audit-yandex-integration.mjs');
const { auditProject } = auditModule;
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const temporaryFixtures = new Set();

function createFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'yandex-audit-test-'));
  temporaryFixtures.add(dir);
  for (const [filePath, content] of Object.entries(files)) {
    const full = join(dir, filePath);
    const parent = dirname(full);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

afterEach(() => {
  for (const dir of temporaryFixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
  temporaryFixtures.clear();
});

function bundledFixture(name) {
  return join(fixturesDir, name);
}

describe('Bundled regression fixtures', () => {
  const failingFixtures = [
    ['missing-sdk', 'YG-SDK-001'],
    ['legacy-loader', 'YG-SDK-002'],
    ['init-before-sdk', 'YG-SDK-003'],
    ['rewarded-wrong', 'YG-SDK-007'],
    ['deprecated-leaderboards', 'YG-SDK-008'],
    ['mock-in-production', 'YG-SDK-010'],
  ];

  for (const [fixtureName, rule] of failingFixtures) {
    it(`${fixtureName} triggers ${rule}`, () => {
      const results = auditProject(bundledFixture(fixtureName));
      assert.ok(
        results.some(result => result.rule === rule && result.level === 'FAIL'),
        `${fixtureName} did not trigger ${rule}: ${JSON.stringify(results)}`,
      );
    });
  }

  it('duplicate-init triggers YG-SDK-004', () => {
    const results = auditProject(bundledFixture('duplicate-init'));
    assert.ok(results.some(result => result.rule === 'YG-SDK-004' && result.level === 'WARN'));
  });

  it('rewarded-correct does not trigger YG-SDK-007', () => {
    const results = auditProject(bundledFixture('rewarded-correct'));
    assert.equal(results.filter(result => result.rule === 'YG-SDK-007').length, 0);
  });

  it('valid-own-domain accepts the official SDK URL', () => {
    const results = auditProject(bundledFixture('valid-own-domain'));
    assert.equal(results.filter(result => result.rule === 'YG-SDK-001').length, 0);
  });

  it('valid-yandex-hosted has no hard failures', () => {
    const results = auditProject(bundledFixture('valid-yandex-hosted'));
    assert.equal(results.filter(result => result.level === 'FAIL').length, 0);
  });

  it('mock-in-test ignores mocks kept in test files', () => {
    const results = auditProject(bundledFixture('mock-in-test'));
    assert.equal(results.filter(result => result.rule === 'YG-SDK-010').length, 0);
  });
});

describe('YG-SDK-001: Missing SDK script', () => {
  it('should FAIL when no SDK script in index.html', () => {
    const dir = createFixture({ 'index.html': '<html><body>Hello</body></html>' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-001' && r.level === 'FAIL'));
  });

  it('should FAIL when an SDK loader-like string exists only in JavaScript', () => {
    const dir = createFixture({
      'index.html': '<script src="game.js"></script>',
      'game.js': 'const documentationExample = `<script src="/sdk.js"></script>`;',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-001' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-002: Legacy loader', () => {
  it('should FAIL when legacy SDK loader is used', () => {
    const dir = createFixture({ 'index.html': '<script src="//yandex.ru/games/sdk/v2/"></script>' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-002' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-003: SDK initialization order', () => {
  it('should FAIL when inline YaGames.init() appears before the SDK script', () => {
    const dir = createFixture({
      'index.html': '<script>YaGames.init().catch(console.error)</script>\n<script src="/sdk.js"></script>',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-003' && r.level === 'FAIL'));
  });

  it('should FAIL when a local game script initializes before the SDK script', () => {
    const dir = createFixture({
      'index.html': '<script src="game.js"></script>\n<script src="/sdk.js"></script>',
      'game.js': 'YaGames.init().catch(console.error);',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-003' && r.level === 'FAIL'));
  });

  it('should PASS when an earlier deferred game script executes after a synchronous SDK', () => {
    const dir = createFixture({
      'index.html': '<script defer src="game.js"></script>\n<script src="/sdk.js"></script>',
      'game.js': 'YaGames.init().catch(console.error);',
    });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-003').length, 0);
  });

  it('should PASS when an earlier inline module executes after a synchronous SDK', () => {
    const dir = createFixture({
      'index.html': [
        '<script type="module">',
        '  YaGames.init().catch(console.error);',
        '</script>',
        '<script src="/sdk.js"></script>',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-003').length, 0);
  });

  it('should FAIL when an async SDK cannot guarantee readiness for a synchronous game script', () => {
    const dir = createFixture({
      'index.html': '<script async src="/sdk.js"></script>\n<script src="game.js"></script>',
      'game.js': 'YaGames.init().catch(console.error);',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-003' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-004: Duplicate initialization', () => {
  it('should WARN when YaGames.init() is called more than once', () => {
    const dir = createFixture({
      'index.html': '<script src="/sdk.js"></script>',
      'game.js': 'YaGames.init().catch(console.error);\nYaGames.init().catch(console.error);',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-004' && r.level === 'WARN'));
  });
});

describe('YG-SDK-005: Game Ready', () => {
  it('should require manual verification when LoadingAPI.ready() is absent', () => {
    const dir = createFixture({ 'index.html': '<script src="/sdk.js"></script>' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-005' && r.level === 'MANUAL'));
  });
});

describe('YG-SDK-001: Valid SDK (Yandex hosted)', () => {
  it('should PASS when /sdk.js is present', () => {
    const dir = createFixture({ 'index.html': '<script src="/sdk.js"></script><script>YaGames.init()</script>' });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-001' && r.level === 'FAIL').length, 0);
  });
});

describe('YG-SDK-001: Valid SDK (own domain)', () => {
  it('should PASS when S3 SDK URL is present', () => {
    const dir = createFixture({ 'index.html': '<script src="https://sdk.games.s3.yandex.net/sdk.js"></script><script>YaGames.init()</script>' });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-001' && r.level === 'FAIL').length, 0);
  });
});

describe('YG-SDK-007: Rewarded in onClose', () => {
  it('should FAIL when reward is given in onClose', () => {
    const dir = createFixture({ 'game.js': 'ysdk.adv.showRewardedVideo({onClose: (w) => { giveReward(); }});' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-007' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-007: Rewarded correct', () => {
  it('should PASS when reward is in onRewarded', () => {
    const dir = createFixture({ 'game.js': 'ysdk.adv.showRewardedVideo({onRewarded: () => { giveReward(); }, onClose: (w) => {}});' });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-007' && r.level === 'FAIL').length, 0);
  });
});

describe('YG-SDK-007: Multi-line onClose with reward', () => {
  it('should FAIL when reward is in multi-line onClose', () => {
    const dir = createFixture({
      'game.js': [
        'ysdk.adv.showRewardedVideo({',
        '  onClose: (wasShown) => {',
        '    giveReward();',
        '  }',
        '});',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-007' && r.level === 'FAIL'));
  });

  it('should FAIL when reward is in multi-line onClose with callbacks wrapper', () => {
    const dir = createFixture({
      'game.js': [
        'ysdk.adv.showRewardedVideo({',
        '  callbacks: {',
        '    onClose: () => {',
        '      grantReward();',
        '    }',
        '  }',
        '});',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-007' && r.level === 'FAIL'));
  });

  it('should PASS when reward is in onRewarded (multi-line)', () => {
    const dir = createFixture({
      'game.js': [
        'ysdk.adv.showRewardedVideo({',
        '  callbacks: {',
        '    onRewarded: () => {',
        '      giveReward();',
        '    },',
        '    onClose: () => {',
        '      console.log("closed");',
        '    },',
        '  },',
        '});',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-007' && r.level === 'FAIL').length, 0);
  });

  it('should PASS when an empty onClose appears before onRewarded', () => {
    const dir = createFixture({
      'game.js': [
        'ysdk.adv.showRewardedVideo({',
        '  callbacks: {',
        '    onClose: () => {',
        '      console.log("closed");',
        '    },',
        '    onRewarded: () => {',
        '      giveReward();',
        '    },',
        '  },',
        '});',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-007').length, 0);
  });

  it('should FAIL for a currency grant in onClose without reward-like function names', () => {
    const dir = createFixture({
      'game.js': [
        'ysdk.adv.showRewardedVideo({ callbacks: {',
        '  onClose: () => {',
        '    player.setData({ coins: state.coins + 100 });',
        '  },',
        '} });',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-007' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-006: GameplayAPI balance', () => {
  it('should WARN when start without stop', () => {
    const dir = createFixture({ 'game.js': 'ysdk.features?.GameplayAPI?.start();' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-006' && r.level === 'WARN'));
  });

  it('should PASS when start and stop are present', () => {
    const dir = createFixture({ 'game.js': 'ysdk.features?.GameplayAPI?.start();\nysdk.features?.GameplayAPI?.stop();' });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-006').length, 0);
  });

  it('should WARN when more stops than starts', () => {
    const dir = createFixture({ 'game.js': 'ysdk.features?.GameplayAPI?.stop();\nysdk.features?.GameplayAPI?.stop();' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-006' && r.level === 'WARN'));
  });
});

describe('YG-SDK-008: Deprecated leaderboards', () => {
  it('should FAIL when deprecated getLeaderboards is used', () => {
    const dir = createFixture({ 'game.js': 'const lb = await ysdk.getLeaderboards();' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-008' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-009: Deprecated player methods', () => {
  it('should FAIL when player.getID is used', () => {
    const dir = createFixture({ 'game.js': 'const id = player.getID();' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-009' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-010: Mock in production', () => {
  it('should FAIL when MockYandex is used outside tests', () => {
    const dir = createFixture({ 'game.js': 'const mock = createMockSDK();' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-010' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-010: Mock in test files', () => {
  it('should NOT FAIL when mock is in test/fixture files', () => {
    const dir = createFixture({ 'index.html': '<html><body></body></html>', 'tests/mock-test.js': 'createMockSDK()' });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-010').length, 0);
  });
});

describe('YG-SDK-011: External payments', () => {
  it('should FAIL when a third-party checkout is present', () => {
    const dir = createFixture({ 'game.js': 'stripe.checkout({ payment: "coins" });' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-011' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-012: Automatic authorization dialog', () => {
  it('should FAIL when authorization opens on DOMContentLoaded', () => {
    const dir = createFixture({
      'game.js': [
        'document.addEventListener("DOMContentLoaded", async () => {',
        '  await ysdk.auth.openAuthDialog();',
        '});',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-012' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-013: Interval-based ads', () => {
  it('should WARN when fullscreen ads are called from setInterval', () => {
    const dir = createFixture({
      'game.js': 'setInterval(() => ysdk.adv.showFullscreenAdv(), 180000);',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-013' && r.level === 'WARN'));
  });
});

describe('YG-SDK-014: Save in game loop', () => {
  it('should WARN when cloud saves are called from a requestAnimationFrame loop', () => {
    const dir = createFixture({
      'game.js': 'function frame(){ player.setData(state); requestAnimationFrame(frame); }',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-014' && r.level === 'WARN'));
  });
});

describe('YG-SDK-015: Client secrets', () => {
  it('should FAIL when a likely API secret is embedded in client code', () => {
    const dir = createFixture({
      'game.js': 'const apiKey = "0123456789abcdef0123456789abcdef";',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-015' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-016: Unsafe evaluation', () => {
  it('should FAIL when eval() is used', () => {
    const dir = createFixture({ 'game.js': 'eval(userInput);' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-016' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-017: Absolute S3 resources', () => {
  it('should FAIL for non-SDK absolute Yandex S3 resources', () => {
    const dir = createFixture({
      'game.js': 'const texture = "https://game-assets.s3.yandex.net/texture.png";',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-017' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-022: Mock fallback in production', () => {
  it('should FAIL when mock fallback is created on error', () => {
    const dir = createFixture({ 'game.js': 'if (typeof YaGames === "undefined") { ysdk = { adv: { showFullscreenAdv: () => {} } }; }' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-022' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-018: Missing index.html', () => {
  it('should FAIL when no index.html in root', () => {
    const dir = createFixture({ 'src/index.html': '<html><body></body></html>' });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-018' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-019: Invalid resource paths', () => {
  it('should FAIL when any bundled resource path contains spaces or Cyrillic', () => {
    const dir = createFixture({
      'index.html': '<script src="/sdk.js"></script>',
      'assets/русская папка/image.png': 'fixture',
    });
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-019' && r.level === 'FAIL'));
  });
});

describe('YG-SDK-021: SDK init error handling', () => {
  it('should accept await YaGames.init() protected by try/catch', () => {
    const dir = createFixture({
      'index.html': '<script src="/sdk.js"></script><script src="game.js"></script>',
      'game.js': [
        'async function start() {',
        '  try {',
        '    const ysdk = await YaGames.init();',
        '    ysdk.features.LoadingAPI?.ready();',
        '  } catch (error) {',
        '    console.error(error);',
        '  }',
        '}',
      ].join('\n'),
    });
    const results = auditProject(dir);
    assert.equal(results.filter(r => r.rule === 'YG-SDK-021').length, 0);
  });
});

describe('YG-SDK-020: Build size', () => {
  it('should require manual review when the analyzed directory exceeds 100 MB', () => {
    const dir = createFixture({ 'index.html': '<script src="/sdk.js"></script>' });
    const largeFile = join(dir, 'large.bin');
    writeFileSync(largeFile, '');
    truncateSync(largeFile, 101 * 1024 * 1024);
    const results = auditProject(dir);
    assert.ok(results.some(r => r.rule === 'YG-SDK-020' && r.level === 'MANUAL'));
  });
});

describe('Complete valid project', () => {
  it('should have no FAIL results for a correctly integrated game', () => {
    const dir = createFixture({
      'index.html': '<script src="/sdk.js"></script><script src="game.js"></script>',
      'game.js': 'const ysdk = await YaGames.init().catch(console.error);\nysdk.features?.LoadingAPI?.ready();\nysdk.features?.GameplayAPI?.start();\nysdk.on("game_api_pause", () => {});\nconst player = await ysdk.getPlayer();\nplayer.getUniqueID();\nconst lb = await ysdk.leaderboards.getDescription("score");\nysdk.adv.showFullscreenAdv({onOpen:()=>{},onClose:(w)=>{}});\nysdk.adv.showRewardedVideo({onRewarded:()=>{},onClose:(w)=>{}});\nconst flags = await ysdk.getFlags({defaultFlags:{}});\nysdk.serverTime();',
    });
    const results = auditProject(dir);
    const fails = results.filter(r => r.level === 'FAIL');
    assert.equal(fails.length, 0, 'FAIL results: ' + JSON.stringify(fails));
  });
});
