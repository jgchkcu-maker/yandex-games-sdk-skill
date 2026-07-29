# SDK initialization and lifecycle

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about (2026-07-29)
Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events (2026-07-29)

## SDK loading

### Archive on Yandex server
```html
<script src="/sdk.js"></script>
```

### Own domain
```html
<script src="https://sdk.games.s3.yandex.net/sdk.js"></script>
```

Legacy `//yandex.ru/games/sdk/v2/` must NOT be used.

## Initialization

```javascript
const ysdk = await YaGames.init();
// or with signed: true for server-side payment verification
const ysdk = await YaGames.init({ signed: true });
```

Critical rules:
- SDK script must be loaded BEFORE `YaGames.init()` is called
- Only ONE `init()` call — cache the promise and the result
- If init fails, the promise rejects; do NOT silently swallow
- Never call multiple parallel inits

## State machine

```
uninitialized → initializing → ready
                    ↓
                 failed
```

- Cache: store the promise to prevent duplicate inits
- On failure: reset only the failed init promise, allow retry
- Never create a mock SDK object in production as init fallback

## Game Ready

```javascript
ysdk.features.LoadingAPI?.ready();
```

Rules:
- Call when all resources are loaded AND the game is ready for interaction
- No loading screens visible at call time
- Use optional chaining `?.` (safe if SDK somehow doesn't have the feature)
- Add idempotent guard: `let gameReadyCalled = false;`
- The debug panel shows green indicator on success
- Timeout is 90 seconds platform-side

## Gameplay API

```javascript
ysdk.features.GameplayAPI?.start();
ysdk.features.GameplayAPI?.stop();
```

### When to call start():
- Level starts
- Menu closed
- Game unpaused (by user or after ad)
- Tab becomes visible again

### When to call stop():
- Level completed or lost
- Menu opened
- Pause activated
- Fullscreen or rewarded ad shown
- Tab hidden

Rules:
- After calling stop(), you MUST call start() again to resume
- Do NOT call start() while a pause reason is still active
- Don't call start() at menu or during ad
- These calls are consistent with platform events `game_api_pause`/`game_api_resume`
