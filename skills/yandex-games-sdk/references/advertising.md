# Advertising

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv (2026-07-29)

## Fullscreen ad

```typescript
ysdk.adv.showFullscreenAdv({
  callbacks: {
    onOpen: () => pauseGame(),
    onClose: (wasShown) => resumeGame(),
    onError: (error) => {
      console.error(error);
      resumeGame();
    },
  },
});
```

Rules:
- Only call in logical pauses (between levels, after level completion)
- Do NOT call via blind `setInterval` — platform manages frequency
- Do NOT call during active gameplay interaction
- Block parallel ad requests
- Guarantee state cleanup on `onClose` and `onError`
- When calling, pause game and audio BEFORE calling showFullscreenAdv
- On close, resume only if no other pause reason is active

## Rewarded video

```typescript
ysdk.adv.showRewardedVideo({
  callbacks: {
    onOpen: () => pauseGame(),
    onRewarded: () => grantReward(),
    onClose: () => resumeGame(),
    onError: (error) => {
      console.error(error);
      resumeGame();
    },
  },
});
```

Critical rules:
- Give reward ONLY in `onRewarded` callback
- Do NOT give reward in `onClose` (even if wasShown is true)
- `onClose` should only clean up ad state and return result
- Show reward clearly before the ad (what the player will get)
- Launch after deliberate user action (button tap)
- Protect against double reward
- Handle re-call correctly (don't block if previous was legitimately closed)
- Reward must be a bonus, NOT required to continue playing

## Sticky banner

```typescript
ysdk.adv.getBannerAdvStatus(): Promise<{ stickyAdvIsShowing: boolean; reason?: 'ADV_IS_NOT_CONNECTED' | 'UNKNOWN' }>;
ysdk.adv.showBannerAdv(): Promise<{ stickyAdvIsShowing: boolean; reason?: ... }>;
ysdk.adv.hideBannerAdv(): Promise<{ stickyAdvIsShowing: boolean }>;
```

Rules:
- Check status before showing
- Must be enabled in Dev Console first
- Do NOT cover important UI
- Do NOT simulate ad block with custom elements
- Do NOT modify or style the ad block
