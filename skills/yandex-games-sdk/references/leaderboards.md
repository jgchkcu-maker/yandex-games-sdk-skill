# Leaderboards

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard (2026-07-29)

## Current API (direct access)

```javascript
ysdk.leaderboards.getDescription('leaderboardName');
ysdk.leaderboards.setScore('leaderboardName', score, extraData?);
ysdk.leaderboards.getPlayerEntry('leaderboardName');
ysdk.leaderboards.getEntries('leaderboardName', options);
```

## Deprecated (DO NOT use)

```javascript
// const lb = await ysdk.getLeaderboards();  // DEPRECATED
// lb.getLeaderboardDescription()            // use ysdk.leaderboards.getDescription()
// lb.setLeaderboardScore()                  // use ysdk.leaderboards.setScore()
// lb.getLeaderboardPlayerEntry()            // use ysdk.leaderboards.getPlayerEntry()
// lb.getLeaderboardEntries()                // use ysdk.leaderboards.getEntries()
```

## Methods

### getDescription
```typescript
function getDescription(leaderboardName: string): Promise<ILeaderboardDescription>
```
Returns appID, name, title (localized), default, sort_order, score_format.

### setScore
```typescript
function setScore(leaderboardName: string, score: number, extraData?: string): Promise<void>
```
- Auth required — check `ysdk.isAvailableMethod('leaderboards.setScore')`
- Rate: 1 request per second
- Score must be non-negative

### getPlayerEntry
```typescript
function getPlayerEntry(leaderboardName: string): Promise<ILeaderboardEntry>
```
- Auth required
- Returns: score, rank, extraData, player (publicName, uniqueID, getAvatarSrc, getAvatarSrcSet)
- Catches `LEADERBOARD_PLAYER_NOT_PRESENT` error if no entry exists
- Rate: 60 requests per 5 minutes

### getEntries
```typescript
function getEntries(leaderboardName: string, options?: {
    includeUser?: boolean;
    quantityAround?: number;  // 1-10, default 5
    quantityTop?: number;     // 1-20, default 5
}): Promise<ILeaderboardEntries>
```
- Auth NOT required for entries
- Rate: 20 requests per 5 minutes

## Error handling

- 404: leaderboard name not found in Dev Console
- `LEADERBOARD_PLAYER_NOT_PRESENT`: player has no entry yet
- Check availability with `ysdk.isAvailableMethod('leaderboards.setScore')` for auth-dependent methods

## UI states to handle

- `loading`: while fetching
- `empty`: no entries yet (first player)
- `unauthorized`: player not logged in (for setScore/getPlayerEntry)
- `error`: network or API errors
