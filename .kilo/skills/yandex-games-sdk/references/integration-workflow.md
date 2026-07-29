# Integration workflow

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about (2026-07-29)

## 1. Determine deployment type

### Archive on Yandex server (recommended)
- SDK path: `<script src="/sdk.js"></script>`
- SafeStorage is automatic
- No CSP configuration needed

### Own domain
- SDK path: `<script src="https://sdk.games.s3.yandex.net/sdk.js"></script>`
- Must configure CSP in console
- Must use `ysdk.getStorage()` for iOS safe storage

## 2. Choose adapter

See SKILL.md adapter selection table.

## 3. Core integration steps

1. Add SDK script to index.html before any init code
2. Initialize with `YaGames.init()` (cached singleton)
3. Call `ysdk.features.LoadingAPI?.ready()` when game is ready
4. Connect GameplayAPI.start/stop to game lifecycle
5. Connect platform events (pause/resume) to game pause system
6. Add ad integration if monetization is needed
7. Add player auth and cloud saves
8. Add leaderboards, purchases, remote config as needed

## 4. Verification

- Run audit script
- Test with sdk-dev-proxy in dev mode
- Test with sdk-dev-proxy in prod mode (requires app ID)
- Verify with debug panel on draft
- Test on all supported devices (desktop, mobile, tablet)

## 5. Moderation preparation

- Run through moderation checklist
- Verify all technical requirements
- Test with currency mock
- Test with network throttling
- Test with focus loss
- Verify all translations
- Check archive size and file names
