/**
 * Yandex Games SDK — Vanilla JS adapter
 *
 * Usage:
 *   const platform = YandexPlatform.create();
 *   await platform.init();
 *   platform.gameReady();
 *   platform.gameplayStart();
 *   platform.showFullscreenAd();
 *   platform.showRewardedAd();
 *   // etc.
 */
const YandexPlatform = (() => {
  const STATE = {
    UNINITIALIZED: 'uninitialized',
    INITIALIZING: 'initializing',
    READY: 'ready',
    FAILED: 'failed',
  };

  const PAUSE_REASONS = {
    USER_MENU: 'user-menu',
    TAB_HIDDEN: 'tab-hidden',
    PLATFORM_EVENT: 'platform-event',
    FULLSCREEN_AD: 'fullscreen-ad',
    REWARDED_AD: 'rewarded-ad',
    PURCHASE_DIALOG: 'purchase-dialog',
    SYSTEM_INTERRUPTION: 'system-interruption',
  };

  class YandexPlatformService {
    #state = STATE.UNINITIALIZED;
    #initPromise = null;
    #ysdk = null;
    #player = null;
    #gameReadyCalled = false;
    #activePauses = new Set();
    #userMuted = false;
    #adInProgress = false;
    #rewardGiven = false;
    #onPauseCallbacks = [];
    #onResumeCallbacks = [];
    #visibilityHandler = null;
    #pauseHandler = null;
    #resumeHandler = null;

    get state() { return this.#state; }
    get isReady() { return this.#state === STATE.READY; }
    get isPaused() { return this.#activePauses.size > 0; }
    get userMuted() { return this.#userMuted; }

    onPause(cb) {
      this.#onPauseCallbacks.push(cb);
      return () => {
        this.#onPauseCallbacks = this.#onPauseCallbacks.filter(callback => callback !== cb);
      };
    }

    onResume(cb) {
      this.#onResumeCallbacks.push(cb);
      return () => {
        this.#onResumeCallbacks = this.#onResumeCallbacks.filter(callback => callback !== cb);
      };
    }

    async init({ signed = false } = {}) {
      if (this.#state === STATE.READY) return this.#ysdk;
      if (this.#state === STATE.INITIALIZING) return this.#initPromise;

      this.#state = STATE.INITIALIZING;
      this.#initPromise = (async () => {
        try {
          if (typeof YaGames === 'undefined') {
            throw new Error('YaGames is not defined. SDK script not loaded before init.');
          }
          this.#ysdk = await YaGames.init({ signed });
          this.#state = STATE.READY;
          this.#setupPlatformEvents();
          return this.#ysdk;
        } catch (err) {
          this.#state = STATE.FAILED;
          this.#initPromise = null;
          throw err;
        }
      })();

      return this.#initPromise;
    }

    async getPlayer({ signed = false } = {}) {
      if (!this.#ysdk) throw new Error('SDK not initialized');
      this.#player = await this.#ysdk.getPlayer({ signed });
      return this.#player;
    }

    gameReady() {
      if (this.#gameReadyCalled) return;
      if (!this.#ysdk) return;
      try {
        this.#ysdk.features?.LoadingAPI?.ready();
        this.#gameReadyCalled = true;
      } catch (err) {
        console.warn('Game Ready call failed:', err);
      }
    }

    gameplayStart() {
      if (!this.#ysdk || this.#activePauses.size > 0) return;
      try {
        this.#ysdk.features?.GameplayAPI?.start();
      } catch (err) {
        console.warn('GameplayAPI.start failed:', err);
      }
    }

    gameplayStop() {
      if (!this.#ysdk) return;
      try {
        this.#ysdk.features?.GameplayAPI?.stop();
      } catch (err) {
        console.warn('GameplayAPI.stop failed:', err);
      }
    }

    addPause(reason) {
      if (this.#activePauses.has(reason)) return;
      const wasEmpty = this.#activePauses.size === 0;
      this.#activePauses.add(reason);
      if (wasEmpty) {
        this.gameplayStop();
        this.#notifyPause();
      }
    }

    removePause(reason) {
      if (!this.#activePauses.has(reason)) return;
      this.#activePauses.delete(reason);
      if (this.#activePauses.size === 0) {
        this.gameplayStart();
        this.#notifyResume();
      }
    }

    setMuted(muted) {
      this.#userMuted = muted;
    }

    showFullscreenAd() {
      if (!this.#ysdk || this.#adInProgress) return;
      this.#adInProgress = true;
      this.addPause(PAUSE_REASONS.FULLSCREEN_AD);

      try {
        this.#ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => {},
            onClose: (wasShown) => {
              this.#adInProgress = false;
              this.removePause(PAUSE_REASONS.FULLSCREEN_AD);
            },
            onError: (err) => {
              console.error('Fullscreen ad error:', err);
              this.#adInProgress = false;
              this.removePause(PAUSE_REASONS.FULLSCREEN_AD);
            },
          },
        });
      } catch (err) {
        console.error('Fullscreen ad exception:', err);
        this.#adInProgress = false;
        this.removePause(PAUSE_REASONS.FULLSCREEN_AD);
      }
    }

    showRewardedAd({ onRewarded } = {}) {
      if (!this.#ysdk || this.#adInProgress) return;
      if (typeof onRewarded !== 'function') {
        throw new Error('onRewarded callback is required for rewarded ads');
      }

      this.#adInProgress = true;
      this.#rewardGiven = false;
      this.addPause(PAUSE_REASONS.REWARDED_AD);

      try {
        this.#ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {},
            onRewarded: () => {
              if (this.#rewardGiven) return;
              this.#rewardGiven = true;
              onRewarded();
            },
            onClose: () => {
              this.#adInProgress = false;
              this.#rewardGiven = false;
              this.removePause(PAUSE_REASONS.REWARDED_AD);
            },
            onError: (err) => {
              console.error('Rewarded ad error:', err);
              this.#adInProgress = false;
              this.#rewardGiven = false;
              this.removePause(PAUSE_REASONS.REWARDED_AD);
            },
          },
        });
      } catch (err) {
        console.error('Rewarded ad exception:', err);
        this.#adInProgress = false;
        this.#rewardGiven = false;
        this.removePause(PAUSE_REASONS.REWARDED_AD);
      }
    }

    async getBannerAdvStatus() {
      if (!this.#ysdk) return { stickyAdvIsShowing: false };
      return this.#ysdk.adv.getBannerAdvStatus();
    }

    async showBannerAdv() {
      if (!this.#ysdk) return { stickyAdvIsShowing: false };
      return this.#ysdk.adv.showBannerAdv();
    }

    async hideBannerAdv() {
      if (!this.#ysdk) return { stickyAdvIsShowing: false };
      return this.#ysdk.adv.hideBannerAdv();
    }

    async getFlags(defaultFlags = {}) {
      if (!this.#ysdk) return defaultFlags;
      try {
        return await this.#ysdk.getFlags({ defaultFlags });
      } catch {
        return defaultFlags;
      }
    }

    get environment() {
      return this.#ysdk?.environment ?? null;
    }

    get deviceInfo() {
      return this.#ysdk?.deviceInfo ?? null;
    }

    get leaderboards() {
      return this.#ysdk?.leaderboards ?? null;
    }

    get payments() {
      return this.#ysdk?.payments ?? null;
    }

    async getPayments(signed = false) {
      if (!this.#ysdk) throw new Error('SDK not initialized');
      return this.#ysdk.getPayments({ signed });
    }

    async getStorage() {
      if (!this.#ysdk) throw new Error('SDK not initialized');
      return this.#ysdk.getStorage();
    }

    serverTime() {
      if (!this.#ysdk) throw new Error('SDK not initialized');
      return this.#ysdk.serverTime();
    }

    #setupPlatformEvents() {
      if (!this.#ysdk) return;

      this.#pauseHandler = () => {
        this.addPause(PAUSE_REASONS.PLATFORM_EVENT);
      };
      this.#resumeHandler = () => {
        this.removePause(PAUSE_REASONS.PLATFORM_EVENT);
      };

      this.#ysdk.on('game_api_pause', this.#pauseHandler);
      this.#ysdk.on('game_api_resume', this.#resumeHandler);

      this.#visibilityHandler = () => {
        if (document.hidden) {
          this.addPause(PAUSE_REASONS.TAB_HIDDEN);
        } else {
          this.removePause(PAUSE_REASONS.TAB_HIDDEN);
        }
      };
      document.addEventListener('visibilitychange', this.#visibilityHandler);
    }

    #notifyPause() {
      for (const cb of this.#onPauseCallbacks) cb();
    }

    #notifyResume() {
      for (const cb of this.#onResumeCallbacks) cb();
    }

    destroy() {
      if (this.#ysdk) {
        if (this.#pauseHandler) this.#ysdk.off('game_api_pause', this.#pauseHandler);
        if (this.#resumeHandler) this.#ysdk.off('game_api_resume', this.#resumeHandler);
      }
      if (this.#visibilityHandler) {
        document.removeEventListener('visibilitychange', this.#visibilityHandler);
      }
      this.#onPauseCallbacks = [];
      this.#onResumeCallbacks = [];
      this.#pauseHandler = null;
      this.#resumeHandler = null;
      this.#visibilityHandler = null;
    }
  }

  let instance = null;

  return {
    create() {
      if (!instance) instance = new YandexPlatformService();
      return instance;
    },
    resetForTesting() {
      if (instance) instance.destroy();
      instance = null;
    },
  };
})();
