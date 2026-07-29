# Troubleshooting

Sources: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about (2026-07-29), https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard (2026-07-29)

## "YaGames is not defined"

SDK script not loaded before `YaGames.init()`. Check:
- Script tag order: `<script src="/sdk.js"></script>` must come BEFORE init code
- Path is correct: `/sdk.js` for archive, `https://sdk.games.s3.yandex.net/sdk.js` for own domain
- No typo in script src

## "ysdk is not defined"

Attempted to use SDK methods before initialization. Ensure:
- `const ysdk = await YaGames.init()` completed
- All SDK calls happen after the await

## Debug panel shows "IF" (loader)

Legacy loader detected. Change:
- FROM: `//yandex.ru/games/sdk/v2/`
- TO: `/sdk.js` (archive) or `https://sdk.games.s3.yandex.net/sdk.js` (own domain)

## Game Ready indicator stays red after 90s

`ysdk.features.LoadingAPI?.ready()` not called. Ensure:
- It's called after all resources are loaded
- It's called when game is ready for interaction
- No guard condition blocks it unnecessarily

## Leaderboard returns 404

- Check that a leaderboard with the exact technical name exists in Dev Console
- Name is case-sensitive

## "LEADERBOARD_PLAYER_NOT_PRESENT"

Player has no score entry yet. This is normal for first-time players. Handle gracefully.

## I18n indicator is red

SDK language detection not used. Change:
```javascript
// FROM: navigator.language
// TO:
const lang = ysdk.environment.i18n.lang;
```

## Data not saving

- Check rate limits: 100 calls per 5 minutes for setData
- Max 200 KB per player for setData
- Ensure flush: true for critical saves
- Check safeStorage for iOS own-domain games

## Rewarded ad not giving reward

- Reward code must be in `onRewarded` callback, NOT in `onClose`
- Check that `onRewarded` is actually being called

## Game does not pause on tab switch

- Subscribe to `document.addEventListener('visibilitychange', ...)`
- Also subscribe to `ysdk.on('game_api_pause', ...)` for platform-initiated pauses
- Pause ALL: game loop, physics, timers, input, audio
