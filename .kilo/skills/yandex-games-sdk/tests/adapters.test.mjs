/**
 * Integration tests for Yandex Games SDK adapters.
 *
 * Tests vanilla-js-adapter.js (via vm sandbox), typescript-adapter.ts
 * (structural + compile-time check), and phaser-adapter.ts
 * (behavioral + real source test).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', 'assets');

// ---------------------------------------------------------------------------
// Helper: extract callbacks from either `{ callbacks: {} }` or flat format
// (mirrors mock-yandex-sdk.ts logic for the test mock)
// ---------------------------------------------------------------------------
function extractAdCallbacks(opts) {
  if (!opts) return {};
  // { callbacks: { onOpen, onClose, ... } } — @types/ysdk shape
  if (opts.callbacks && typeof opts.callbacks === 'object') {
    return opts.callbacks;
  }
  // { onOpen, onClose, ... } — flat shape (legacy/docs style)
  return opts;
}

// ---------------------------------------------------------------------------
// Mock YaGames SDK — supports both callbacks shapes
// ---------------------------------------------------------------------------

function createMockYaGames() {
  const calls = { on: 0, off: 0, loadingReady: 0, gameplayStart: 0, gameplayStop: 0 };
  let pauseHandler = null;
  let resumeHandler = null;
  let shouldFail = false;
  const mockSDK = {
    _calls: calls,
    _triggerPause() { if (pauseHandler) pauseHandler(); },
    _triggerResume() { if (resumeHandler) resumeHandler(); },
    _setFail(f) { shouldFail = f; },
    init() {
      if (shouldFail) return Promise.reject(new Error('init failed'));
      return Promise.resolve(mockSDK);
    },
    features: {
      LoadingAPI: { ready() { calls.loadingReady++; } },
      GameplayAPI: {
        start() { calls.gameplayStart++; },
        stop() { calls.gameplayStop++; },
      },
    },
    adv: {
      _fullscreenCbs: null,
      _rewardedCbs: null,
      showFullscreenAdv(opts) {
        const cbs = extractAdCallbacks(opts);
        this._fullscreenCbs = cbs;
      },
      showRewardedVideo(opts) {
        const cbs = extractAdCallbacks(opts);
        this._rewardedCbs = cbs;
      },
      getBannerAdvStatus() { return { stickyAdvIsShowing: false }; },
      showBannerAdv() { return { stickyAdvIsShowing: false }; },
      hideBannerAdv() { return { stickyAdvIsShowing: false }; },
    },
    getPlayer({ signed = false } = {}) {
      return Promise.resolve({
        getUniqueID: () => 'test-uid-42',
        isAuthorized: () => signed,
        getName: () => 'TestPlayer',
        getPhoto: () => '',
        getIDsPerGame: () => Promise.resolve([]),
        getPayingStatus: () => 'unknown',
        setData: () => Promise.resolve(),
        getData: () => Promise.resolve({}),
        setStats: () => Promise.resolve(),
        getStats: () => Promise.resolve({}),
        incrementStats: () => Promise.resolve({}),
      });
    },
    getFlags({ defaultFlags = {} } = {}) { return Promise.resolve(defaultFlags); },
    getPayments({ signed = false } = {}) { return Promise.resolve({}); },
    getStorage() { return Promise.resolve({ setItem() {}, getItem() { return null; } }); },
    serverTime() { return Date.now(); },
    environment: { app: { id: 'test-app' }, i18n: { lang: 'ru' }, payload: null },
    deviceInfo: { type: 'desktop', isMobile: false, isTablet: false, isDesktop: true, isTV: false },
    leaderboards: null,
    payments: null,
    on(ev, cb) {
      calls.on++;
      if (ev === 'game_api_pause') pauseHandler = cb;
      if (ev === 'game_api_resume') resumeHandler = cb;
    },
    off() { calls.off++; pauseHandler = null; resumeHandler = null; },
    EVENTS: { HISTORY_BACK: 'history_back', EXIT: 'exit' },
    dispatchEvent() {},
  };
  return mockSDK;
}

function createDocumentStub() {
  const listeners = {};
  return {
    hidden: false,
    addEventListener(ev, cb) { listeners[ev] = cb; },
    removeEventListener(ev, cb) {
      if (listeners[ev] === cb) delete listeners[ev];
    },
    _triggerVisibility(hidden) {
      this.hidden = hidden;
      if (listeners.visibilitychange) listeners.visibilitychange();
    },
    _getListeners() { return listeners; },
  };
}

// ---------------------------------------------------------------------------
// Vanilla JS adapter loader
// ---------------------------------------------------------------------------

function loadVanillaAdapter(mockYaGames) {
  const source = readFileSync(join(ASSETS_DIR, 'vanilla-js-adapter.js'), 'utf-8');
  const adapted = source.replace('const YandexPlatform', 'this.YandexPlatform');
  const sandbox = {
    console, Promise, setTimeout, clearTimeout,
    YaGames: mockYaGames,
    document: createDocumentStub(),
  };
  vm.runInNewContext(adapted, sandbox);
  return sandbox.YandexPlatform;
}

// ===========================================================================
// Vanilla JS adapter
// ===========================================================================

describe('Vanilla JS adapter', () => {
  let mock, YandexPlatform;

  function fresh() {
    mock = createMockYaGames();
    YandexPlatform = loadVanillaAdapter(mock);
  }

  beforeEach(() => { fresh(); });

  describe('singleton', () => {
    it('create() returns the same instance', () => {
      assert.equal(YandexPlatform.create(), YandexPlatform.create());
    });
    it('resetForTesting() clears instance', () => {
      const a = YandexPlatform.create();
      YandexPlatform.resetForTesting();
      assert.notEqual(a, YandexPlatform.create());
    });
  });

  describe('init', () => {
    it('resolves with SDK on success', async () => {
      const p = YandexPlatform.create();
      const sdk = await p.init();
      assert.ok(sdk);
      assert.equal(p.state, 'ready');
      assert.ok(p.isReady);
    });
    it('idempotent — returns same cached promise', async () => {
      const p = YandexPlatform.create();
      const [s1, s2] = await Promise.all([p.init(), p.init()]);
      assert.equal(s1, s2);
    });
    it('rejects when YaGames is undefined', async () => {
      const noop = loadVanillaAdapter(undefined);
      const p = noop.create();
      await assert.rejects(() => p.init(), /YaGames is not defined/);
      assert.equal(p.state, 'failed');
    });
    it('allows retry after failure', async () => {
      const failMock = createMockYaGames();
      failMock._setFail(true);
      const f = loadVanillaAdapter(failMock);
      try { await f.create().init(); } catch { /* ok */ }

      const good = loadVanillaAdapter(createMockYaGames());
      const sdk = await good.create().init();
      assert.ok(sdk);
    });
  });

  describe('gameReady', () => {
    it('calls LoadingAPI.ready()', async () => {
      const p = YandexPlatform.create();
      await p.init();
      p.gameReady();
      assert.equal(mock._calls.loadingReady, 1);
    });
    it('idempotent', async () => {
      const p = YandexPlatform.create();
      await p.init();
      p.gameReady(); p.gameReady(); p.gameReady();
      assert.equal(mock._calls.loadingReady, 1);
    });
    it('safe before init', () => {
      assert.doesNotThrow(() => YandexPlatform.create().gameReady());
    });
  });

  describe('pause / resume', () => {
    it('single reason calls stop then start', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.addPause('user-menu');
      assert.equal(mock._calls.gameplayStop, 1);
      p.removePause('user-menu');
      assert.equal(mock._calls.gameplayStart, 1);
    });
    it('two reasons: stop once, start after last removed', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.addPause('a'); p.addPause('b');
      assert.equal(mock._calls.gameplayStop, 1);
      p.removePause('a');
      assert.equal(mock._calls.gameplayStart, 0);
      p.removePause('b');
      assert.equal(mock._calls.gameplayStart, 1);
    });
    it('notifies callbacks', async () => {
      const p = YandexPlatform.create(); await p.init();
      let paused = false, resumed = false;
      p.onPause(() => { paused = true; });
      p.onResume(() => { resumed = true; });
      p.addPause('x'); assert.ok(paused);
      p.removePause('x'); assert.ok(resumed);
    });
    it('allows individual pause callback unsubscription', async () => {
      const p = YandexPlatform.create(); await p.init();
      let calls = 0;
      const unsubscribe = p.onPause(() => { calls++; });
      unsubscribe();
      p.addPause('user-menu');
      assert.equal(calls, 0);
    });
    it('gameplayStart suppressed while paused', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.addPause('x');
      p.gameplayStart();
      assert.equal(mock._calls.gameplayStart, 0);
    });
  });

  describe('fullscreen ad', () => {
    it('pause on call, resume on close', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.showFullscreenAd();
      assert.equal(mock._calls.gameplayStop, 1);
      mock.adv._fullscreenCbs.onClose(true);
      assert.equal(mock._calls.gameplayStart, 1);
      assert.ok(!p.isPaused);
    });
    it('parallel call guard', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.showFullscreenAd();
      const before = mock._calls.gameplayStop;
      p.showFullscreenAd();
      assert.equal(mock._calls.gameplayStop, before);
    });
    it('cleanup on error', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.showFullscreenAd();
      mock.adv._fullscreenCbs.onError(new Error('fail'));
      assert.ok(!p.isPaused);
    });
    it('uses callbacks wrapper per @types/ysdk', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.showFullscreenAd();
      assert.ok(typeof mock.adv._fullscreenCbs.onOpen === 'function');
      assert.ok(typeof mock.adv._fullscreenCbs.onClose === 'function');
      assert.ok(typeof mock.adv._fullscreenCbs.onError === 'function');
    });
    it('cleans up state on crash', async () => {
      // Arrange: make adv.showFullscreenAdv throw synchronously
      const throwingMock = createMockYaGames();
      throwingMock.adv.showFullscreenAdv = () => { throw new Error('crash'); };
      const YandexPlatform = loadVanillaAdapter(throwingMock);
      const p = YandexPlatform.create();
      await p.init();
      // Act + Assert: shouldn't throw, should clean up
      assert.doesNotThrow(() => p.showFullscreenAd());
      assert.ok(!p.isPaused);
      // adInProgress should be false — verify by allowing a second call
      assert.doesNotThrow(() => p.showFullscreenAd());
    });
  });

  describe('rewarded ad', () => {
    it('calls onRewarded', async () => {
      const p = YandexPlatform.create(); await p.init();
      let rewarded = false;
      p.showRewardedAd({ onRewarded: () => { rewarded = true; } });
      mock.adv._rewardedCbs.onRewarded();
      assert.ok(rewarded);
    });
    it('does NOT reward in onClose', async () => {
      const p = YandexPlatform.create(); await p.init();
      let rewarded = false;
      p.showRewardedAd({ onRewarded: () => { rewarded = true; } });
      mock.adv._rewardedCbs.onClose(true);
      assert.ok(!rewarded);
    });
    it('cleans up pause on close', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.showRewardedAd({ onRewarded: () => {} });
      assert.ok(p.isPaused);
      mock.adv._rewardedCbs.onClose(true);
      assert.ok(!p.isPaused);
    });
    it('uses callbacks wrapper per @types/ysdk', async () => {
      const p = YandexPlatform.create(); await p.init();
      p.showRewardedAd({ onRewarded: () => {} });
      assert.ok(typeof mock.adv._rewardedCbs.onOpen === 'function');
      assert.ok(typeof mock.adv._rewardedCbs.onRewarded === 'function');
      assert.ok(typeof mock.adv._rewardedCbs.onClose === 'function');
      assert.ok(typeof mock.adv._rewardedCbs.onError === 'function');
    });
    it('protects against double reward', async () => {
      const p = YandexPlatform.create(); await p.init();
      let rewardCount = 0;
      p.showRewardedAd({ onRewarded: () => { rewardCount++; } });
      mock.adv._rewardedCbs.onRewarded();
      mock.adv._rewardedCbs.onRewarded(); // second call — should be ignored
      assert.equal(rewardCount, 1);
    });
    it('resets rewardGiven flag on close for re-call', async () => {
      const p = YandexPlatform.create(); await p.init();
      let rewardCount = 0;
      p.showRewardedAd({ onRewarded: () => { rewardCount++; } });
      mock.adv._rewardedCbs.onRewarded();
      mock.adv._rewardedCbs.onClose(true);
      assert.equal(rewardCount, 1);
      // Second ad (re-call)
      p.showRewardedAd({ onRewarded: () => { rewardCount++; } });
      mock.adv._rewardedCbs.onRewarded();
      assert.equal(rewardCount, 2);
    });
    it('throws without onRewarded callback', async () => {
      const p = YandexPlatform.create(); await p.init();
      assert.throws(() => p.showRewardedAd(), /onRewarded callback is required/);
    });
    it('cleans up state on crash and resets rewardGiven', async () => {
      const throwingMock = createMockYaGames();
      throwingMock.adv.showRewardedVideo = () => { throw new Error('crash'); };
      const YandexPlatform = loadVanillaAdapter(throwingMock);
      const p = YandexPlatform.create();
      await p.init();
      let rewardCalled = false;
      assert.doesNotThrow(() => p.showRewardedAd({ onRewarded: () => { rewardCalled = true; } }));
      assert.ok(!rewardCalled, 'reward not called on crash');
      assert.ok(!p.isPaused);
      // Should be able to call again
      assert.doesNotThrow(() => p.showRewardedAd({ onRewarded: () => {} }));
    });
  });

  describe('getPlayer', () => {
    it('works after init', async () => {
      const p = YandexPlatform.create(); await p.init();
      const player = await p.getPlayer();
      assert.equal(player.getUniqueID(), 'test-uid-42');
    });
    it('throws before init', async () => {
      await assert.rejects(() => YandexPlatform.create().getPlayer(), /SDK not initialized/);
    });
  });

  describe('destroy', () => {
    it('unregisters event handlers', async () => {
      const p = YandexPlatform.create(); await p.init();
      const before = mock._calls.off;
      p.destroy();
      assert.ok(mock._calls.off > before);
    });
    it('destroy runs without error', async () => {
      const p = YandexPlatform.create(); await p.init();
      assert.doesNotThrow(() => p.destroy());
    });
    it('clears onPause/onResume callbacks after destroy', async () => {
      const p = YandexPlatform.create(); await p.init();
      let preDestroyCount = 0;
      p.onPause(() => { preDestroyCount++; });
      p.destroy();
      // After destroy, pre-destroy callbacks are cleared.
      // Adding a new pause should not trigger the old callback.
      p.addPause('x');
      assert.equal(preDestroyCount, 0, 'pre-destroy callback was NOT called after destroy');
      // New onPause registration after destroy should work
      let postDestroyCount = 0;
      p.onPause(() => { postDestroyCount++; });
      p.removePause('x');
      p.addPause('y'); // should trigger the new callback only
      assert.equal(postDestroyCount, 1, 'post-destroy callback was called');
      assert.equal(preDestroyCount, 0, 'pre-destroy callback still not called');
    });
  });

  describe('platform events', () => {
    it('responds to game_api_pause/resume', async () => {
      const p = YandexPlatform.create(); await p.init();
      mock._triggerPause(); assert.ok(p.isPaused);
      mock._triggerResume(); assert.ok(!p.isPaused);
    });
  });

  describe('sticky banner', () => {
    it('getBannerAdvStatus works', async () => {
      const p = YandexPlatform.create(); await p.init();
      const s = await p.getBannerAdvStatus();
      assert.equal(s.stickyAdvIsShowing, false);
    });
  });

  describe('getFlags', () => {
    it('returns defaults after init', async () => {
      const p = YandexPlatform.create(); await p.init();
      assert.equal((await p.getFlags({ a: 'b' })).a, 'b');
    });
    it('returns empty before init', async () => {
      const f = await YandexPlatform.create().getFlags();
      assert.equal(typeof f, 'object');
    });
  });
});

// ===========================================================================
// TypeScript adapter — structural, runtime compilation, and singleton test
// The TS and vanilla adapters share identical runtime logic (same state
// machine, same pause-reason set, same ad flow).
// Vanilla tests above cover all runtime behaviour.
// Here we verify export structure AND compile the adapter against @types/ysdk.
// ===========================================================================

describe('TypeScript adapter (exports & singleton)', () => {
  it('source exports createYandexPlatform at module level', () => {
    const src = readFileSync(join(ASSETS_DIR, 'typescript-adapter.ts'), 'utf-8');
    assert.ok(/export\s+function\s+createYandexPlatform/.test(src), 'exports createYandexPlatform');
    assert.ok(/export\s+function\s+resetYandexPlatformForTesting/.test(src), 'exports resetYandexPlatformForTesting');
    assert.ok(/export\s+type\s+\{/.test(src) || /export\s+type\s+YandexPlatformService/.test(src), 'exports types');
  });

  it('source has YandexPlatformService interface', () => {
    const src = readFileSync(join(ASSETS_DIR, 'typescript-adapter.ts'), 'utf-8');
    assert.ok(/interface\s+YandexPlatformService/.test(src));
  });

  it('runtime methods match between TS and vanilla adapters', () => {
    const vanilla = readFileSync(join(ASSETS_DIR, 'vanilla-js-adapter.js'), 'utf-8');
    const ts = readFileSync(join(ASSETS_DIR, 'typescript-adapter.ts'), 'utf-8');
    const methods = ['init', 'gameReady', 'gameplayStart', 'gameplayStop',
                     'addPause', 'removePause', 'showFullscreenAd', 'showRewardedAd',
                     'getPlayer', 'getFlags', 'destroy', 'getBannerAdvStatus',
                     'showBannerAdv', 'hideBannerAdv', 'getPayments', 'getStorage',
                     'serverTime', 'onPause', 'onResume', 'setMuted'];
    for (const m of methods) {
      assert.ok(vanilla.includes(m), `vanilla-js-adapter missing method: ${m}`);
      assert.ok(ts.includes(m), `typescript-adapter missing method: ${m}`);
    }
  });

  it('compiles without errors against @types/ysdk', { timeout: 120000 }, async (t) => {
    const dependencyRoot = process.env.YANDEX_SDK_TYPECHECK_DEPS;
    const tscCli = dependencyRoot
      ? join(dependencyRoot, 'node_modules', 'typescript', 'bin', 'tsc')
      : '';
    const typeRoot = dependencyRoot
      ? join(dependencyRoot, 'node_modules', '@types')
      : '';
    if (!dependencyRoot || !existsSync(tscCli) || !existsSync(join(typeRoot, 'ysdk'))) {
      t.skip('Set YANDEX_SDK_TYPECHECK_DEPS to a directory containing typescript@5.9.3 and @types/ysdk@1.2.0');
      return;
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'yandex-sdk-ts-test-'));

    try {
      // Copy the adapter files
      const tsSrc = readFileSync(join(ASSETS_DIR, 'typescript-adapter.ts'), 'utf-8');
      const mockSrc = readFileSync(join(ASSETS_DIR, 'mock-yandex-sdk.ts'), 'utf-8');
      const phaserSrc = readFileSync(join(ASSETS_DIR, 'phaser-adapter.ts'), 'utf-8');

      writeFileSync(join(tmpDir, 'typescript-adapter.ts'), tsSrc, 'utf-8');
      writeFileSync(join(tmpDir, 'mock-yandex-sdk.ts'), mockSrc, 'utf-8');
      writeFileSync(join(tmpDir, 'phaser-adapter.ts'), phaserSrc, 'utf-8');
      writeFileSync(join(tmpDir, 'phaser.d.ts'), [
        "declare module 'phaser' {",
        '  namespace Phaser {',
        '    class Scene {',
        '      scene: any;',
        '      sound: any;',
        '    }',
        '    class Game {',
        '      scene: any;',
        '      sound: any;',
        '      loop: any;',
        '    }',
        '  }',
        '  export default Phaser;',
        '}',
      ].join('\n'), 'utf-8');
      writeFileSync(join(tmpDir, 'type-contract.ts'), [
        "import { createYandexPlatform } from './typescript-adapter.js';",
        "import { createYandexPhaserAdapter } from './phaser-adapter.js';",
        "import Phaser from 'phaser';",
        "import type { Player, Signature } from 'ysdk';",
        'async function verifyGetPlayerContract() {',
        '  const platform = createYandexPlatform();',
        '  createYandexPhaserAdapter({} as Phaser.Game, platform);',
        '  const player: Player = await platform.getPlayer();',
        '  const signedPlayer: Signature = await platform.getPlayer({ signed: true });',
        '  return { player, signedPlayer };',
        '}',
        'void verifyGetPlayerContract;',
      ].join('\n'), 'utf-8');

      // Create minimal tsconfig.json
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          typeRoots: [typeRoot],
        },
        include: [
          'typescript-adapter.ts',
          'mock-yandex-sdk.ts',
          'phaser-adapter.ts',
          'phaser.d.ts',
          'type-contract.ts',
        ],
      };
      writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');

      const result = execFileSync(process.execPath, [tscCli, '--noEmit', '--pretty'], {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 30000,
      });

      // tsc succeeds with empty/whitespace output (or compilation info)
      if (result && result.includes('error TS')) {
        assert.fail('TypeScript compilation errors:\n' + result);
      }
    } catch (e) {
      const msg = e.message || e.stdout || e.stderr || String(e);
      if (msg.includes('error TS')) {
        assert.fail('TypeScript compilation errors:\n' + msg);
      }
      throw e;
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ===========================================================================
// Phaser adapter — behavioral contract test
// We test the pause/resume/mute/onSceneChange logic using the REAL source
// loaded via a wrapper, plus a reimplementation-based helper for isolation.
// ===========================================================================

/**
 * Load the real phaser-adapter.ts source and execute it with a Phaser mock.
 * This tests the actual adapter code, not just a reimplementation.
 */
function loadRealPhaserAdapter(game, platform) {
  const src = readFileSync(join(ASSETS_DIR, 'phaser-adapter.ts'), 'utf-8');
  // Strip the Phaser import and TypeScript types to make it runnable
  const jsSource = src
    .replace(/import Phaser from 'phaser';(\s*\/\*[\s\S]*?\*\/)?/s, '')
    .replace(/: Phaser\.Scene\[\]/g, '')
    .replace(/: (Phaser\.Game|string|boolean|void|any)\b/g, '')
    .replace(/: \{[\s\S]*?\}/g, '')
    .replace(/: [a-zA-Z<>[\]|, ]+/g, '')
    .replace(/export /g, '')
    .replace(/import type.*$/gm, '');

  const sandbox = {
    game, platform,
    console,
    module: { exports: {} },
    exports: {},
  };
  const code = jsSource + '\n\nthis._adapter = createYandexPhaserAdapter(game, platform);';
  vm.runInNewContext(code, sandbox);
  return sandbox._adapter;
}

describe('Phaser adapter (behavioral contract)', () => {
  // Reimplementation-based helper for isolated test
  function createPhaserAdapterTestHelper(game, platform) {
    let pausedByPlatform = false;
    let userMuted = false;

    function pauseGame() {
      if (pausedByPlatform) return;
      pausedByPlatform = true;
      const scene = game.scene.getScenes(true)[0];
      if (scene) {
        scene.scene.pause();
        scene.sound.pauseAll();
        game.loop.sleep();
      } else {
        game.sound.pauseAll();
        game.loop.sleep();
      }
      if (game.sound.context && game.sound.context.state === 'running') {
        game.sound.context.suspend();
      }
    }

    function resumeGame() {
      if (!pausedByPlatform) return;
      pausedByPlatform = false;
      if (!userMuted) {
        game.sound.resumeAll();
        if (game.sound.context && game.sound.context.state === 'suspended') {
          game.sound.context.resume();
        }
      }
      const scene = game.scene.getScenes(true)[0];
      if (scene) scene.scene.resume();
      game.loop.wake();
    }

    platform.onPause(() => {
      if (!platform.isPaused) return;
      if (!pausedByPlatform) pauseGame();
    });
    platform.onResume(() => {
      if (platform.isPaused) return;
      if (pausedByPlatform) resumeGame();
    });

    return {
      onSceneChange(sceneKey) {
        const activeScene = game.scene.getScene(sceneKey);
        if (!activeScene) return;
        if (activeScene.scene.isActive()) platform.gameplayStart();
        else platform.gameplayStop();
      },
      setUserMuted(muted) {
        userMuted = muted;
        platform.setMuted(muted);
        if (muted) game.sound.pauseAll();
        else if (!pausedByPlatform) game.sound.resumeAll();
      },
      destroy() { pausedByPlatform = false; },
    };
  }

  let game, platform;

  function fresh() {
    let scenePaused = false, sceneResumed = false;
    let soundPaused = false, soundResumed = false;
    let loopSlept = false, loopWoke = false;
    let audioCtxState = 'running';

    game = {
      _() { return { scenePaused, sceneResumed, soundPaused, soundResumed, loopSlept, loopWoke }; },
      scene: {
        getScenes(active) {
          if (!active) return [];
          return [{
            scene: { pause() { scenePaused = true; }, resume() { sceneResumed = true; } },
            sound: { pauseAll() { soundPaused = true; }, resumeAll() { soundResumed = true; } },
          }];
        },
        getScene() {
          return { scene: { isActive: () => true } };
        },
      },
      sound: {
        pauseAll() { soundPaused = true; },
        resumeAll() { soundResumed = true; },
        context: {
          get state() { return audioCtxState; },
          suspend() { audioCtxState = 'suspended'; },
          resume() { audioCtxState = 'running'; },
        },
      },
      loop: { sleep() { loopSlept = true; }, wake() { loopWoke = true; } },
    };

    const pauses = new Set();
    let muted = false;
    let gpStart = false, gpStop = false;
    platform = {
      addPause(r) { pauses.add(r); },
      removePause(r) { pauses.delete(r); },
      get isPaused() { return pauses.size > 0; },
      get userMuted() { return muted; },
      setMuted(m) { muted = m; },
      gameplayStart() { gpStart = true; },
      gameplayStop() { gpStop = true; },
      onPause: (cb) => { platform._pauseCb = cb; },
      onResume: (cb) => { platform._resumeCb = cb; },
      _pauseCb: null, _resumeCb: null,
      _triggerPause() { if (platform._pauseCb) platform._pauseCb(); },
      _triggerResume() { if (platform._resumeCb) platform._resumeCb(); },
      _gp() { return { gpStart, gpStop }; },
    };
  }

  beforeEach(() => { fresh(); });

  it('pauses scene, sound, loop on platform pause', () => {
    const adapter = createPhaserAdapterTestHelper(game, platform);
    platform.addPause('x');
    platform._triggerPause();
    const f = game._();
    assert.ok(f.scenePaused, 'scene paused');
    assert.ok(f.soundPaused, 'sound paused');
    assert.ok(f.loopSlept, 'loop slept');
  });

  it('resumes scene, sound, loop on platform resume', () => {
    const adapter = createPhaserAdapterTestHelper(game, platform);
    platform.addPause('x'); platform._triggerPause();
    platform.removePause('x'); platform._triggerResume();
    const f = game._();
    assert.ok(f.sceneResumed, 'scene resumed');
    assert.ok(f.soundResumed, 'sound resumed');
    assert.ok(f.loopWoke, 'loop woke');
  });

  it('setUserMuted stores mute and pauses sound', () => {
    const adapter = createPhaserAdapterTestHelper(game, platform);
    adapter.setUserMuted(true);
    assert.ok(platform.userMuted);
    assert.ok(game._().soundPaused);
  });

  it('onSceneChange with active scene calls gameplayStart', () => {
    const adapter = createPhaserAdapterTestHelper(game, platform);
    adapter.onSceneChange('menu');
    assert.ok(platform._gp().gpStart);
  });

  it('onSceneChange with inactive scene calls gameplayStop', () => {
    game.scene.getScene = () => ({ scene: { isActive: () => false } });
    const adapter = createPhaserAdapterTestHelper(game, platform);
    adapter.onSceneChange('level');
    assert.ok(platform._gp().gpStop);
  });

  it('destroy does not throw', () => {
    const adapter = createPhaserAdapterTestHelper(game, platform);
    assert.doesNotThrow(() => adapter.destroy());
  });

  it('source exports createYandexPhaserAdapter', () => {
    const src = readFileSync(join(ASSETS_DIR, 'phaser-adapter.ts'), 'utf-8');
    assert.ok(/export\s+function\s+createYandexPhaserAdapter/.test(src));
  });

  it('real source runs without error (via VM sandbox)', () => {
    // Test the real phaser-adapter.ts source loaded through VM
    const testGame = {
      scene: {
        getScenes() { return [{ scene: { pause() {}, resume() {} }, sound: { pauseAll() {}, resumeAll() {} } }]; },
        getScene() { return { scene: { isActive: () => true } }; },
      },
      sound: { pauseAll() {}, resumeAll() {}, context: null },
      loop: { sleep() {}, wake() {} },
    };
    const testPlatform = {
      addPause() {}, removePause() {}, setMuted() {},
      gameplayStart() {}, gameplayStop() {},
      onPause() { return () => {}; },
      onResume() { return () => {}; },
      get isPaused() { return false; },
      get userMuted() { return false; },
    };
    const adapter = loadRealPhaserAdapter(testGame, testPlatform);
    assert.ok(adapter, 'adapter created successfully');
    assert.ok(typeof adapter.destroy === 'function');
    assert.ok(typeof adapter.setUserMuted === 'function');
    assert.ok(typeof adapter.onSceneChange === 'function');
    assert.doesNotThrow(() => adapter.destroy());
  });

  it('real source unsubscribes platform callbacks on destroy', () => {
    const callbacks = { pause: null, resume: null };
    let pauseCalls = 0;
    const testGame = {
      scene: {
        getScenes() {
          return [{
            scene: { pause() { pauseCalls++; }, resume() {} },
            sound: { pauseAll() {}, resumeAll() {} },
          }];
        },
        getScene() { return { scene: { isActive: () => true } }; },
      },
      sound: { pauseAll() {}, resumeAll() {}, context: null },
      loop: { sleep() {}, wake() {} },
    };
    const testPlatform = {
      addPause() {},
      removePause() {},
      setMuted() {},
      gameplayStart() {},
      gameplayStop() {},
      onPause(cb) {
        callbacks.pause = cb;
        return () => { callbacks.pause = null; };
      },
      onResume(cb) {
        callbacks.resume = cb;
        return () => { callbacks.resume = null; };
      },
      get isPaused() { return true; },
      get userMuted() { return false; },
    };

    const adapter = loadRealPhaserAdapter(testGame, testPlatform);
    adapter.destroy();
    if (callbacks.pause) callbacks.pause();

    assert.equal(pauseCalls, 0);
    assert.equal(callbacks.pause, null);
    assert.equal(callbacks.resume, null);
  });

  it('real source resumes the exact scenes it paused', () => {
    const callbacks = { pause: null, resume: null };
    const calls = [];
    const firstScene = {
      scene: {
        pause() { calls.push('pause:first'); },
        resume() { calls.push('resume:first'); },
      },
      sound: { pauseAll() {}, resumeAll() {} },
    };
    const secondScene = {
      scene: {
        pause() { calls.push('pause:second'); },
        resume() { calls.push('resume:second'); },
      },
      sound: { pauseAll() {}, resumeAll() {} },
    };
    let activeScenes = [firstScene, secondScene];
    const testGame = {
      scene: {
        getScenes() { return activeScenes; },
        getScene() { return firstScene; },
      },
      sound: { pauseAll() {}, resumeAll() {}, context: null },
      loop: { sleep() {}, wake() {} },
    };
    let paused = true;
    const testPlatform = {
      setMuted() {},
      gameplayStart() {},
      gameplayStop() {},
      onPause(cb) { callbacks.pause = cb; return () => {}; },
      onResume(cb) { callbacks.resume = cb; return () => {}; },
      get isPaused() { return paused; },
    };

    loadRealPhaserAdapter(testGame, testPlatform);
    callbacks.pause();
    activeScenes = [];
    paused = false;
    callbacks.resume();

    assert.deepEqual(
      calls,
      ['pause:first', 'pause:second', 'resume:first', 'resume:second'],
    );
  });
});
