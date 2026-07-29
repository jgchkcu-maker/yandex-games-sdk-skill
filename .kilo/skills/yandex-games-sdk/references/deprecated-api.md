# Deprecated API

Checked on 2026-07-29.

## SDK loader

| Deprecated | Replacement |
|---|---|
| `//yandex.ru/games/sdk/v2/` | `/sdk.js` (Yandex server) or `https://sdk.games.s3.yandex.net/sdk.js` (own domain) |

## Leaderboards

| Deprecated | Replacement |
|---|---|
| `const lb = await ysdk.getLeaderboards()` | Direct `ysdk.leaderboards.*` |
| `lb.getLeaderboardDescription(name)` | `ysdk.leaderboards.getDescription(name)` |
| `lb.setLeaderboardScore(name, score)` | `ysdk.leaderboards.setScore(name, score)` |
| `lb.getLeaderboardPlayerEntry(name)` | `ysdk.leaderboards.getPlayerEntry(name)` |
| `lb.getLeaderboardEntries(name, opts)` | `ysdk.leaderboards.getEntries(name, opts)` |

## Player

| Deprecated | Replacement | Notes |
|---|---|---|
| `player.getID()` | `player.getUniqueID()` | Values may differ; migrate existing data |
| `player.getMode()` | `player.isAuthorized()` | Returns `'lite' \| ''`, deprecated |

## Migration guide

### Leaderboard migration
```javascript
// BEFORE (deprecated)
const lb = await ysdk.getLeaderboards();
const desc = await lb.getLeaderboardDescription('score');

// AFTER
const desc = await ysdk.leaderboards.getDescription('score');
```

### Player ID migration
```javascript
// BEFORE (deprecated)
const id = player.getID();

// AFTER
const id = player.getUniqueID();
```

If your game previously used `player.getID()` to store data, migrate those records to use `getUniqueID()`. If massive migration is needed, contact Yandex support.
