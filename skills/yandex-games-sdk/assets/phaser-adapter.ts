import Phaser from 'phaser';

/**
 * Phaser 3 adapter for Yandex Games SDK.
 *
 * Connects the platform service to the Phaser game instance:
 * - Pauses/resumes the active scene during ads and platform events
 * - Manages audio context suspend/resume
 * - Calls GameplayAPI based on scene transitions
 *
 * Usage:
 *   import { createYandexPlatform } from './typescript-adapter';
 *   import { createYandexPhaserAdapter } from './phaser-adapter';
 *
 *   const platform = createYandexPlatform();
 *   const phaserAdapter = createYandexPhaserAdapter(game, platform);
 *   await platform.init();
 *   platform.gameReady();
 */
export function createYandexPhaserAdapter(
  game: Phaser.Game,
  platform: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    onPause: (cb: () => void) => () => void;
    onResume: (cb: () => void) => () => void;
    setMuted: (muted: boolean) => void;
    isPaused: boolean;
  },
) {
  let pausedByPlatform = false;
  let userMuted = false;
  let pausedScenes: Phaser.Scene[] = [];

  function pauseGame() {
    if (pausedByPlatform) return;
    pausedByPlatform = true;

    pausedScenes = [...game.scene.getScenes(true)];
    for (const scene of pausedScenes) {
      scene.scene.pause();
      scene.sound.pauseAll();
    }
    if (pausedScenes.length === 0) {
      game.sound.pauseAll();
    }
    game.loop.sleep();

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

    for (const scene of pausedScenes) {
      scene.scene.resume();
    }
    pausedScenes = [];
    game.loop.wake();
  }

  const unsubscribePause = platform.onPause(() => {
    if (!platform.isPaused) return;
    if (!pausedByPlatform) {
      pauseGame();
    }
  });

  const unsubscribeResume = platform.onResume(() => {
    if (platform.isPaused) return;
    if (pausedByPlatform) {
      resumeGame();
    }
  });

  return {
    onSceneChange(sceneKey: string) {
      const activeScene = game.scene.getScene(sceneKey);
      if (!activeScene) return;

      if (activeScene.scene.isActive()) {
        platform.gameplayStart();
      } else {
        platform.gameplayStop();
      }
    },

    setUserMuted(muted: boolean) {
      userMuted = muted;
      platform.setMuted(muted);
      if (muted) {
        game.sound.pauseAll();
      } else if (!pausedByPlatform) {
        game.sound.resumeAll();
      }
    },

    destroy() {
      unsubscribePause();
      unsubscribeResume();
      if (pausedByPlatform) resumeGame();
      pausedScenes = [];
    },
  };
}
