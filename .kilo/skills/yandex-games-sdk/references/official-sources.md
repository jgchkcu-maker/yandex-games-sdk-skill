# Official sources

All sources verified on 2026-07-29.

## SDK documentation

| URL | Sections checked |
|---|---|
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-about | SDK connection (archive vs own domain), init, troubleshooting |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events | Game Ready, GameplayAPI.start/stop |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-player | getPlayer, auth, setData/getData, setStats/getStats, getUniqueID, getName, getPhoto, getPayingStatus, limits |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv | showFullscreenAdv, showRewardedVideo, getBannerAdvStatus, showBannerAdv, hideBannerAdv |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases | getPayments, purchase, getPurchases, getCatalog, consumePurchase, signature |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard | getDescription, setScore, getPlayerEntry, getEntries, limits, deprecated getLeaderboards |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment | environment.app, i18n, payload, referrer |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-config | getFlags, defaultFlags, clientFeatures |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time | serverTime(), daily reward examples |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-events | game_api_pause, game_api_resume, HISTORY_BACK, EXIT, account dialog |
| https://yandex.ru/dev/games/doc/ru/sdk/sdk-params | screen.fullscreen, clipboard, deviceInfo |

## Testing and debugging

| URL | Sections checked |
|---|---|
| https://yandex.ru/dev/games/doc/ru/concepts/local-launch | Prod env, dev env, sdk-dev-proxy, purchases-catalog.json, params |
| https://yandex.ru/dev/games/doc/ru/console/debug-panel | Loader indicator, Game Ready indicator, language, tools, gamepad, clock |

## Requirements and moderation

| URL | Sections checked |
|---|---|
| https://yandex.ru/dev/games/doc/ru/concepts/requirements | All technical, UX, content, advertising, promo requirements |

## Key findings

1. **SDK connection**: Archive on Yandex server uses `/sdk.js`. Own domain uses `https://sdk.games.s3.yandex.net/sdk.js`. The old `//yandex.ru/games/sdk/v2/` is legacy.
2. **Leaderboards**: Direct access via `ysdk.leaderboards.*`. `ysdk.getLeaderboards()` is deprecated.
3. **Player**: `player.getUniqueID()` replaces `player.getID()`. `player.getMode()` deprecated.
4. **Events**: Use `ysdk.on('game_api_pause', cb)` / `ysdk.off(...)`. They are consistent with GameplayAPI.
5. **Local storage**: SafeStorage available via `ysdk.getStorage()` for own-domain games on iOS.
