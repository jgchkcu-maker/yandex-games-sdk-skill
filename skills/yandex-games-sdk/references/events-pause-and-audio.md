# Events, pause and audio

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-events (2026-07-29)
Source: https://yandex.ru/dev/games/doc/ru/concepts/requirements (2026-07-29)

## Platform events

```javascript
ysdk.on('game_api_pause', callback);
ysdk.on('game_api_resume', callback);
ysdk.off('game_api_pause', callback);
ysdk.off('game_api_resume', callback);
```

Events fire for:
- Fullscreen ad (including startup ad)
- Rewarded ad
- Purchase dialog
- Browser tab switch
- Window minimization

Events are consistent with GameplayAPI: platform calls `GameplayAPI.stop()` on pause and `GameplayAPI.start()` on resume. If the game already called `GameplayAPI.stop()` (user menu), subsequent `game_api_pause` won't double-stop; corresponding resume won't auto-start.

## Multiple pause reasons pattern

```typescript
type PauseReason =
  | 'user-menu'
  | 'tab-hidden'
  | 'platform-event'
  | 'fullscreen-ad'
  | 'rewarded-ad'
  | 'purchase-dialog'
  | 'system-interruption';
```

Use a `Set<PauseReason>` to track active pauses. Only resume when the set is empty.

## Audio rules

- Sound MUST stop when tab is hidden (requirement 1.3)
- Sound MUST stop during fullscreen and rewarded ads (requirement 4.7)
- User mute preference must be stored separately from temporary platform mute
- Do NOT re-enable sound after resume if user previously muted it
- If using Web Audio API, call `audioContext.suspend()` and `audioContext.resume()`

## Other events

```javascript
ysdk.on(ysdk.EVENTS.HISTORY_BACK, () => { /* show exit dialog */ });
ysdk.dispatchEvent(ysdk.EVENTS.EXIT);
ysdk.on(ysdk.EVENTS.ACCOUNT_SELECTION_DIALOG_OPENED, () => { /* stop sync */ });
ysdk.on(ysdk.EVENTS.ACCOUNT_SELECTION_DIALOG_CLOSED, async () => { /* re-fetch player */ });
```
