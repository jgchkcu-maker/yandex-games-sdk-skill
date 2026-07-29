/**
 * Mock Yandex Games SDK for testing and development only.
 *
 * WARNING: NEVER import this file in production builds.
 * Use only in unit tests or with explicit dev flag.
 *
 * Supports controlled scenarios:
 * - Successful init / init error
 * - Authorized / guest player
 * - Fullscreen ad / rewarded ad / ad error
 * - Leaderboard with/without player entry
 * - Purchases, catalog, consume
 * - Remote config
 * - Server time
 * - Platform events
 * - Sticky banner
 */
class MockPlayer {
  private data: Record<string, unknown> = {};
  private stats: Record<string, number> = {};
  private authorized: boolean;
  public uniqueID: string;

  constructor(authorized: boolean, uniqueID: string) {
    this.authorized = authorized;
    this.uniqueID = uniqueID;
  }

  isAuthorized() { return this.authorized; }
  getUniqueID() { return this.uniqueID; }
  getName() { return this.authorized ? 'TestPlayer' : ''; }
  getPhoto(_size: 'small' | 'medium' | 'large') { return ''; }
  getPayingStatus() { return this.authorized ? 'not_paying' as const : 'unknown' as const; }

  async setData(data: Record<string, unknown>, _flush?: boolean) {
    this.data = { ...this.data, ...data };
  }

  async getData(keys?: string[]) {
    if (!keys) return { ...this.data };
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (k in this.data) result[k] = this.data[k];
    }
    return result;
  }

  async setStats(stats?: Record<string, number>) {
    if (stats) this.stats = { ...this.stats, ...stats };
  }

  async getStats(keys?: string[]) {
    if (!keys) return { ...this.stats };
    const result: Record<string, number> = {};
    for (const k of keys) {
      if (k in this.stats) result[k] = this.stats[k];
    }
    return result;
  }

  async incrementStats(increments: Record<string, number>) {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(increments)) {
      this.stats[k] = (this.stats[k] ?? 0) + v;
      result[k] = this.stats[k];
    }
    return result;
  }
}

class MockPayments {
  private catalog: Array<Record<string, unknown>>;
  private purchases: Array<Record<string, unknown>> = [];

  constructor(catalog?: Array<Record<string, unknown>>) {
    this.catalog = catalog ?? [
      { id: 'coin_100', title: '100 Coins', description: '100 in-game coins', price: '1 USD', priceValue: '1', priceCurrencyCode: 'USD', imageURI: '' },
    ];
  }

  async getCatalog() { return [...this.catalog]; }
  async getPurchases() { return [...this.purchases]; }
  async purchase({ id }: { id: string }) {
    const token = `mock-token-${Date.now()}`;
    this.purchases.push({ productID: id, purchaseToken: token, developerPayload: '' });
    return { productID: id, purchaseToken: token, developerPayload: '' };
  }
  async consumePurchase(purchaseToken: string) {
    this.purchases = this.purchases.filter(p => p.purchaseToken !== purchaseToken);
  }
}

interface MockAdCallbacks {
  onOpen?: () => void;
  onRewarded?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (error: unknown) => void;
}

/**
 * Extract callbacks from either `{ callbacks: { ... } }` or flat format.
 * The official SDK accepts both forms; @types/ysdk uses `{ callbacks: {} }`.
 */
function extractAdCallbacks(opts?: unknown): MockAdCallbacks {
  if (!opts) return {};
  const o = opts as Record<string, unknown>;
  // { callbacks: { onOpen, onClose, ... } } — @types/ysdk shape
  if (o.callbacks && typeof o.callbacks === 'object') {
    return o.callbacks as MockAdCallbacks;
  }
  // { onOpen, onClose, ... } — flat shape
  return o as unknown as MockAdCallbacks;
}

export class MockYandexSDK {
  features = {
    LoadingAPI: { ready: () => {} },
    GameplayAPI: { start: () => {}, stop: () => {} },
  };
  environment = {
    app: { id: 'mock_app' },
    i18n: { lang: 'en' },
  };
  deviceInfo = {
    type: 'desktop' as const,
    isMobile: () => false,
    isDesktop: () => true,
    isTablet: () => false,
    isTV: () => false,
  };
  screen = { fullscreen: { status: 'on', request: async () => {}, exit: async () => {} } };
  clipboard = { writeText: async (_text: string) => {} };

  private player: MockPlayer;
  private serverTimeOffset = 0;
  private callbacks = new Map<string, Array<(...args: unknown[]) => void>>();
  private bannerStatus = { stickyAdvIsShowing: false };
  private adScenario: 'success' | 'error' | 'close' = 'success';
  private initShouldFail = false;

  constructor(config?: { authorized?: boolean; initShouldFail?: boolean; adScenario?: 'success' | 'error' | 'close' }) {
    this.player = new MockPlayer(config?.authorized ?? true, `mock-uid-${Date.now()}`);
    this.initShouldFail = config?.initShouldFail ?? false;
    this.adScenario = config?.adScenario ?? 'success';
  }

  async getPlayer() { return this.player; }
  async getPayments() { return new MockPayments(); }
  get payments() { return new MockPayments(); }

  leaderboards = {
    getDescription: async (_name: string) => ({ name: _name, title: { en: 'Score' }, default: true, description: { sort_order: 'DESC', score_format: { options: { decimal_offset: 0 }, type: 'numeric' as const }, invert_sort_order: false }, appID: 'mock' }),
    setScore: async (_name: string, _score: number, _extraData?: string) => {},
    getPlayerEntry: async (_name: string) => ({ score: 100, rank: 1, extraData: '', player: { publicName: 'Test', uniqueID: this.player.uniqueID, getAvatarSrc: () => '', getAvatarSrcSet: () => '' } }),
    getEntries: async (_name: string, _opts?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number }) => ({
      leaderboard: { name: _name, title: { en: 'Score' }, default: true, description: { sort_order: 'DESC', score_format: { options: { decimal_offset: 0 }, type: 'numeric' as const }, invert_sort_order: false }, appID: 'mock' },
      ranges: [{ start: 0, size: 10 }],
      userRank: 1,
      entries: [{ score: 100, rank: 1, extraData: '', player: { publicName: 'Test', uniqueID: this.player.uniqueID, getAvatarSrc: () => '', getAvatarSrcSet: () => '' } }],
    }),
  };

  adv = {
    showFullscreenAdv: (opts?: unknown) => {
      const cbs = extractAdCallbacks(opts);
      cbs.onOpen?.();
      if (this.adScenario === 'error') {
        cbs.onError?.(new Error('mock ad error'));
      } else {
        cbs.onClose?.(this.adScenario === 'success');
      }
    },
    showRewardedVideo: (opts?: unknown) => {
      const cbs = extractAdCallbacks(opts);
      cbs.onOpen?.();
      if (this.adScenario === 'error') {
        cbs.onError?.(new Error('mock ad error'));
      } else {
        if (this.adScenario === 'success') cbs.onRewarded?.();
        cbs.onClose?.(this.adScenario === 'success');
      }
    },
    getBannerAdvStatus: async () => ({ ...this.bannerStatus }),
    showBannerAdv: async () => { this.bannerStatus.stickyAdvIsShowing = true; return { stickyAdvIsShowing: true }; },
    hideBannerAdv: async () => { this.bannerStatus.stickyAdvIsShowing = false; return { stickyAdvIsShowing: false }; },
  };

  async getFlags<T extends Record<string, string>>(params?: { defaultFlags?: T }) {
    return (params?.defaultFlags ?? {}) as T;
  }

  serverTime() { return Date.now() + this.serverTimeOffset; }
  setServerTimeOffset(offset: number) { this.serverTimeOffset = offset; }

  on(event: string, cb: (...args: unknown[]) => void) {
    if (!this.callbacks.has(event)) this.callbacks.set(event, []);
    this.callbacks.get(event)?.push(cb);
  }

  off(event: string, cb: (...args: unknown[]) => void) {
    const list = this.callbacks.get(event);
    if (list) {
      const idx = list.indexOf(cb);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  emit(event: string, ...args: unknown[]) {
    this.callbacks.get(event)?.forEach(cb => cb(...args));
  }

  async isAvailableMethod(_name: string) { return true; }
}

export function createMockSDK(config?: { authorized?: boolean; initShouldFail?: boolean; adScenario?: 'success' | 'error' | 'close' }) {
  return new MockYandexSDK(config);
}
