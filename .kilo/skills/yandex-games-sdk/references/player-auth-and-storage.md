# Player, auth and storage

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-player (2026-07-29)

## Getting the player

```javascript
const player = await ysdk.getPlayer();
// signed:true returns a signature payload for server-side verification,
// not a Player object:
const signedPlayer = await ysdk.getPlayer({ signed: true });
await sendToServer(signedPlayer.signature);
```

Rate limit: 20 requests per 5 minutes.

Do not call Player methods such as `getUniqueID()` or `isAuthorized()` on the
result of `getPlayer({ signed: true })`. Use the returned `signature` on a
trusted server.

## Auth

Check auth:
```javascript
player.isAuthorized(); // true | false
```

Open auth dialog (only after user action):
```javascript
await ysdk.auth.openAuthDialog();
player = await ysdk.getPlayer(); // re-fetch after auth
```

Critical rules:
- Game MUST work without auth (guest mode, requirement 1.2.2)
- Guest progress MUST be saved locally
- Show explanation of WHY auth is beneficial BEFORE opening dialog
- Only open dialog after deliberate user action
- After success, re-fetch player object
- User refusal must not break the game or loop dialogs

## Cloud saves

### player.setData(data, flush)
```typescript
function setData(data: object, flush: boolean): Promise<void>
```
- Max 200 KB per player
- `flush: true` = immediate, `false` = queued
- Rate limit: 100 requests per 5 minutes

### player.getData(keys?)
```typescript
function getData(keys?: Array<string>): Promise<object>
```
- Returns all data if keys omitted

### Stats (numeric values, frequently changed)
```typescript
function setStats(stats?: object): Promise<void>
function incrementStats(increments: object): Promise<object>
function getStats(keys?: Array<string>): Promise<object>
```
- Max 10 KB per player
- Rate limit: 60 requests per minute

## Safe storage (own domain iOS)

```javascript
const safeStorage = await ysdk.getStorage();
safeStorage.setItem('key', 'value');
safeStorage.getItem('key');
```

For own-domain games on iOS, localStorage may be cleared. Use safeStorage or globally override:

```javascript
Object.defineProperty(window, 'localStorage', { get: () => safeStorage });
```

## Save strategy

1. Load cloud data on game start
2. Merge with local data (define conflict resolution)
3. Use versioned schema for migration
4. Validate types on load
5. Debounce writes (e.g., 2 seconds after last change)
6. Immediate write on critical points (level complete, purchase)
7. Do NOT save every frame
8. Do NOT overwrite cloud saves with empty local object

## Profile data

```typescript
player.getUniqueID(): string;       // replaces deprecated getID()
player.getIDsPerGame(): Promise<Array<{ appID: number; userID: string }>>; // auth-only, check with isAvailableMethod
player.getName(): string;
player.getPhoto(size: 'small' | 'medium' | 'large'): string;
player.getPayingStatus(): 'paying' | 'partially_paying' | 'not_paying' | 'unknown';
```

Deprecated: `player.getID()`, `player.getMode()`.
