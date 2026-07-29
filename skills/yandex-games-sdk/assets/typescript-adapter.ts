import type { SDK, Player, Signature } from 'ysdk';

type PauseReason =
  | 'user-menu'
  | 'tab-hidden'
  | 'platform-event'
  | 'fullscreen-ad'
  | 'rewarded-ad'
  | 'purchase-dialog'
  | 'system-interruption';

type AdResult =
  | { type: 'success'; wasShown: boolean }
  | { type: 'rewarded' }
  | { type: 'error'; error: unknown }
  | { type: 'cancelled'; wasShown: boolean };

interface YandexPlatformService {
  readonly state: 'uninitialized' | 'initializing' | 'ready' | 'failed';
  readonly isReady: boolean;
  readonly isPaused: boolean;
  readonly activePauses: ReadonlySet<PauseReason>;

  init(options?: { signed?: boolean }): Promise<SDK>;
  getPlayer(options: { signed: true }): Promise<Signature>;
  getPlayer(options?: { signed?: false }): Promise<Player>;
  gameReady(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  addPause(reason: PauseReason): void;
  removePause(reason: PauseReason): void;
  setMuted(muted: boolean): void;
  showFullscreenAd(): void;
  showRewardedAd(onRewarded: () => void): void;
  getBannerAdvStatus(): Promise<{ stickyAdvIsShowing: boolean; reason?: string }>;
  showBannerAdv(): Promise<{ stickyAdvIsShowing: boolean; reason?: string }>;
  hideBannerAdv(): Promise<{ stickyAdvIsShowing: boolean }>;
  getFlags<T extends Record<string, string>>(defaultFlags?: T): Promise<T>;
  getPayments(signed?: boolean): Promise<unknown>;
  getStorage(): Promise<Storage>;
  serverTime(): number;
  onPause(cb: () => void): () => void;
  onResume(cb: () => void): () => void;
  destroy(): void;
}

class YandexPlatformServiceImpl implements YandexPlatformService {
  private state_: 'uninitialized' | 'initializing' | 'ready' | 'failed' = 'uninitialized';
  private initPromise_: Promise<SDK> | null = null;
  private ysdk_: SDK | null = null;
  private player_: Player | null = null;
  private gameReadyCalled_ = false;
  private activePauses_ = new Set<PauseReason>();
  private userMuted_ = false;
  private adInProgress_ = false;
  private rewardGiven_ = false;
  private onPauseCallbacks_: Array<() => void> = [];
  private onResumeCallbacks_: Array<() => void> = [];
  private visibilityHandler_: (() => void) | null = null;
  private pauseHandler_: (() => void) | null = null;
  private resumeHandler_: (() => void) | null = null;

  get state() { return this.state_; }
  get isReady() { return this.state_ === 'ready'; }
  get isPaused() { return this.activePauses_.size > 0; }
  get activePauses() { return this.activePauses_; }

  onPause(cb: () => void): () => void {
    this.onPauseCallbacks_.push(cb);
    return () => {
      this.onPauseCallbacks_ = this.onPauseCallbacks_.filter(callback => callback !== cb);
    };
  }

  onResume(cb: () => void): () => void {
    this.onResumeCallbacks_.push(cb);
    return () => {
      this.onResumeCallbacks_ = this.onResumeCallbacks_.filter(callback => callback !== cb);
    };
  }

  async init({ signed = false } = {}): Promise<SDK> {
    if (this.state_ === 'ready') return this.ysdk_!;
    if (this.state_ === 'initializing') return this.initPromise_!;

    this.state_ = 'initializing';
    this.initPromise_ = (async () => {
      try {
        if (typeof YaGames === 'undefined') {
          throw new Error('YaGames is not defined. SDK script not loaded before init.');
        }
        this.ysdk_ = await YaGames.init({ signed });
        this.state_ = 'ready';
        this.setupPlatformEvents_();
        return this.ysdk_;
      } catch (err) {
        this.state_ = 'failed';
        this.initPromise_ = null;
        throw err;
      }
    })();

    return this.initPromise_;
  }

  getPlayer(options: { signed: true }): Promise<Signature>;
  getPlayer(options?: { signed?: false }): Promise<Player>;
  async getPlayer({ signed = false }: { signed?: boolean } = {}): Promise<Player | Signature> {
    if (!this.ysdk_) throw new Error('SDK not initialized');
    const result = await this.ysdk_.getPlayer({ signed });
    if ('getUniqueID' in result) this.player_ = result;
    return result;
  }

  gameReady(): void {
    if (this.gameReadyCalled_) return;
    if (!this.ysdk_) return;
    try {
      this.ysdk_.features?.LoadingAPI?.ready();
      this.gameReadyCalled_ = true;
    } catch (err) {
      console.warn('Game Ready call failed:', err);
    }
  }

  gameplayStart(): void {
    if (!this.ysdk_ || this.activePauses_.size > 0) return;
    try {
      this.ysdk_.features?.GameplayAPI?.start();
    } catch (err) {
      console.warn('GameplayAPI.start failed:', err);
    }
  }

  gameplayStop(): void {
    if (!this.ysdk_) return;
    try {
      this.ysdk_.features?.GameplayAPI?.stop();
    } catch (err) {
      console.warn('GameplayAPI.stop failed:', err);
    }
  }

  addPause(reason: PauseReason): void {
    if (this.activePauses_.has(reason)) return;
    const wasEmpty = this.activePauses_.size === 0;
    this.activePauses_.add(reason);
    if (wasEmpty) {
      this.gameplayStop();
      this.notifyPause_();
    }
  }

  removePause(reason: PauseReason): void {
    if (!this.activePauses_.has(reason)) return;
    this.activePauses_.delete(reason);
    if (this.activePauses_.size === 0) {
      this.gameplayStart();
      this.notifyResume_();
    }
  }

  setMuted(muted: boolean): void {
    this.userMuted_ = muted;
  }

  showFullscreenAd(): void {
    if (!this.ysdk_ || this.adInProgress_) return;
    this.adInProgress_ = true;
    this.addPause('fullscreen-ad');

    try {
      this.ysdk_.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => {},
          onClose: (_wasShown: boolean) => {
            this.adInProgress_ = false;
            this.removePause('fullscreen-ad');
          },
          onError: (err: unknown) => {
            console.error('Fullscreen ad error:', err);
            this.adInProgress_ = false;
            this.removePause('fullscreen-ad');
          },
        },
      });
    } catch (err) {
      console.error('Fullscreen ad exception:', err);
      this.adInProgress_ = false;
      this.removePause('fullscreen-ad');
    }
  }

  showRewardedAd(onRewarded: () => void): void {
    if (!this.ysdk_ || this.adInProgress_) return;
    this.adInProgress_ = true;
    this.rewardGiven_ = false;
    this.addPause('rewarded-ad');

    try {
      this.ysdk_.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => {},
          onRewarded: () => {
            if (this.rewardGiven_) return;
            this.rewardGiven_ = true;
            onRewarded();
          },
          onClose: () => {
            this.adInProgress_ = false;
            this.rewardGiven_ = false;
            this.removePause('rewarded-ad');
          },
          onError: (err: unknown) => {
            console.error('Rewarded ad error:', err);
            this.adInProgress_ = false;
            this.rewardGiven_ = false;
            this.removePause('rewarded-ad');
          },
        },
      });
    } catch (err) {
      console.error('Rewarded ad exception:', err);
      this.adInProgress_ = false;
      this.rewardGiven_ = false;
      this.removePause('rewarded-ad');
    }
  }

  async getBannerAdvStatus(): Promise<{ stickyAdvIsShowing: boolean; reason?: string }> {
    if (!this.ysdk_) return { stickyAdvIsShowing: false };
    return this.ysdk_.adv.getBannerAdvStatus();
  }

  async showBannerAdv(): Promise<{ stickyAdvIsShowing: boolean; reason?: string }> {
    if (!this.ysdk_) return { stickyAdvIsShowing: false };
    const result = await this.ysdk_.adv.showBannerAdv();
    // @types/ysdk returns { reason?: StickyAdvError }, but we also need stickyAdvIsShowing
    return { stickyAdvIsShowing: true, ...result };
  }

  async hideBannerAdv(): Promise<{ stickyAdvIsShowing: boolean }> {
    if (!this.ysdk_) return { stickyAdvIsShowing: false };
    return this.ysdk_.adv.hideBannerAdv();
  }

  async getFlags<T extends Record<string, string>>(defaultFlags?: T): Promise<T> {
    if (!this.ysdk_) return (defaultFlags ?? {}) as T;
    try {
      return await this.ysdk_.getFlags({ defaultFlags: defaultFlags ?? {} }) as T;
    } catch {
      return (defaultFlags ?? {}) as T;
    }
  }

  get environment() { return this.ysdk_?.environment ?? null; }
  get deviceInfo() { return this.ysdk_?.deviceInfo ?? null; }
  get leaderboards() { return this.ysdk_?.leaderboards ?? null; }
  get payments() { return this.ysdk_?.payments ?? null; }

  async getPayments(signed = false): Promise<unknown> {
    if (!this.ysdk_) throw new Error('SDK not initialized');
    return this.ysdk_.getPayments({ signed });
  }

  async getStorage(): Promise<Storage> {
    if (!this.ysdk_) throw new Error('SDK not initialized');
    return this.ysdk_.getStorage();
  }

  serverTime(): number {
    if (!this.ysdk_) throw new Error('SDK not initialized');
    return this.ysdk_.serverTime();
  }

  private setupPlatformEvents_(): void {
    if (!this.ysdk_) return;

    this.pauseHandler_ = () => { this.addPause('platform-event'); };
    this.resumeHandler_ = () => { this.removePause('platform-event'); };

    this.ysdk_.on('game_api_pause', this.pauseHandler_);
    this.ysdk_.on('game_api_resume', this.resumeHandler_);

    this.visibilityHandler_ = () => {
      if (document.hidden) {
        this.addPause('tab-hidden');
      } else {
        this.removePause('tab-hidden');
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler_);
  }

  private notifyPause_(): void {
    for (const cb of this.onPauseCallbacks_) cb();
  }

  private notifyResume_(): void {
    for (const cb of this.onResumeCallbacks_) cb();
  }

  destroy(): void {
    if (this.ysdk_) {
      if (this.pauseHandler_) this.ysdk_.off('game_api_pause', this.pauseHandler_);
      if (this.resumeHandler_) this.ysdk_.off('game_api_resume', this.resumeHandler_);
    }
    if (this.visibilityHandler_) {
      document.removeEventListener('visibilitychange', this.visibilityHandler_);
    }
    this.onPauseCallbacks_ = [];
    this.onResumeCallbacks_ = [];
    this.pauseHandler_ = null;
    this.resumeHandler_ = null;
    this.visibilityHandler_ = null;
  }
}

let instance: YandexPlatformServiceImpl | null = null;

export function createYandexPlatform(): YandexPlatformService {
  if (!instance) instance = new YandexPlatformServiceImpl();
  return instance;
}

export function resetYandexPlatformForTesting(): void {
  if (instance) instance.destroy();
  instance = null;
}

export type { YandexPlatformService, PauseReason, AdResult };
