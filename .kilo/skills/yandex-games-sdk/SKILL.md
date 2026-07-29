---
name: yandex-games-sdk
description: Integrate, audit, debug, update, and prepare HTML5, JavaScript, TypeScript, Vite, and Phaser games for Yandex Games. Use when the user asks to подключить Yandex SDK, добавить рекламу или сохранения, исправить интеграцию Яндекс Игр, подготовить игру к модерации, проверить Game Ready, GameplayAPI, рекламу, авторизацию, лидерборды, покупки, локализацию или провести Yandex Games SDK audit.
license: MIT
compatibility: Kilo Code with filesystem and terminal access; network access is required only when refreshing official documentation.
metadata:
  version: 1.2.0
  platform: yandex-games
  verified: 2026-07-29
---
# Yandex Games SDK Skill

## When to use

Apply this skill when the user requests any Yandex Games SDK integration, audit, or fix task. Specific triggers:

- **Integration**: "подключи Yandex SDK", "добавь Yandex Games", "интегрируй Яндекс Игры"
- **Advertising**: "добавь рекламу", "rewarded video", "полноэкранная реклама", "стики-баннер"
- **Saves/Player**: "сохранения", "авторизация", "статистика игрока", "облачные сохранения", "гостевой режим"
- **Leaderboards**: "лидерборды", "таблица рекордов", "рейтинг"
- **Purchases**: "покупки", "инап-покупки", "монетизация"
- **Localization**: "локализация", "язык", "i18n"
- **Moderation**: "модерация Яндекс Игр", "подготовить к публикации", "проверить требования"
- **Audit**: "Yandex Games SDK audit", "проверь интеграцию", "найди ошибки SDK"
- **Game Ready / Gameplay**: "Game Ready", "разметка геймплея", "LoadingAPI", "GameplayAPI"
- **Testing**: "локальное тестирование", "sdk-dev-proxy", "debug panel"
- **Framework-specific**: "Phaser Yandex SDK", "Vite Яндекс Игры", "React Yandex Games"

## When NOT to use

- The task is about Yandex **Maps**, **Metrika**, **Direct**, or other non-Games Yandex services
- The user only needs general HTML5 game development without any platform integration
- The game is for a different platform (Steam, Google Play, App Store, VK Play)

## Source priority

1. Current official Yandex Games SDK documentation at https://yandex.ru/dev/games/doc/ru/sdk
2. Official Yandex Games moderation requirements at https://yandex.ru/dev/games/doc/ru/concepts/requirements
3. Official `@types/ysdk` npm package for TypeScript type verification only
4. Existing project files

When official docs and existing files contradict, official docs win. Never invent SDK methods.

## Workflow

### Phase A — Analyze the project

Before editing any file, find and understand:

1. Entry point (usually `index.html`), bundler (Vite, Webpack, Parcel), framework (Vanilla JS, Phaser 3, React, TypeScript)
2. Game loop, scene manager, physics, timers, input system, audio system, pause mechanism, saves
3. All existing Yandex SDK references: `YaGames`, `ysdk`, `showFullscreenAdv`, `showRewardedVideo`, `LoadingAPI`, `GameplayAPI`, `getPlayer`, `leaderboards`, `getPayments`, `game_api_pause`, `game_api_resume`
4. Whether multiple independent SDK wrappers exist
5. Deployment type: archive on Yandex server OR own domain

Do NOT modify files until analysis is complete.

### Phase B — Plan

Produce a short plan listing:
- Files to be modified
- SDK methods needed
- Which adapter applies
- Existing game systems that need to connect to the adapter
- Tests to write or update
- Items requiring manual draft verification

### Phase C — Tests first

For any logic being changed, create or update tests first. Minimum coverage:

- Singleton initialization
- SDK load failure
- Game Ready guard (idempotent)
- Correct pause/resume with multiple simultaneous reasons
- Fullscreen ad flow
- Rewarded ad: reward only in `onRewarded`
- Reward NOT given in `onClose`
- Ad error and close-without-show
- Guest mode
- Auth after user action (not on start)
- Save load before first save
- Save debounce
- Deprecated leaderboards detection
- No mock in production

### Phase D — Implementation

Make minimal changes. Isolate the SDK in one service/adapter layer. Game scenes should NOT contain direct `ysdk.*` calls if a single adapter can handle them.

### Phase E — Verification

1. Run unit tests: `node --test .kilo/skills/yandex-games-sdk/tests/*.test.mjs`
2. Run skill self-validation: `node .kilo/skills/yandex-games-sdk/scripts/validate-skill.mjs`
3. Run TypeScript typecheck if TS adapter is used: `npx tsc --noEmit --strict` (requires `@types/ysdk`)
4. Run linter if available
5. Build production
6. Run the audit script: `node .kilo/skills/yandex-games-sdk/scripts/audit-yandex-integration.mjs <dist-dir>`
7. Verify no legacy loader (`//yandex.ru/games/sdk/v2/`)
8. Verify no mock in production bundle
9. Verify no console errors
10. Prepare commands for SDK Dev Proxy
11. List manual checks needed in draft and debug panel

## Adapter selection

| Project type | Adapter | Notes |
|---|---|---|
| Single HTML/JS file | `vanilla-js-adapter.js` | Compact service, no bundler needed |
| Vite / TypeScript | `typescript-adapter.ts` | Official `@types/ysdk`, separate platform service |
| Phaser 3 | `phaser-adapter.ts` | Links to active scene, physics, tweens, timers, input, sound, scene pause/resume |
| Unknown engine | Build minimal custom adapter | Determine lifecycle API first; do NOT insert Phaser code blindly |

## Required pre-change checks

- Read the file before modifying
- Understand existing game mechanics, UI, saves, audio, pause system
- Do NOT rewrites game mechanics for adapter convenience
- Do NOT delete existing saves

## Required post-change checks

- `npm test` or `node --test` if test runner available
- `npm run lint` if available
- `npm run typecheck` if TypeScript
- Audit script passes at `PASS`/`WARN` level (not `FAIL` for critical rules)
- No legacy loader
- No mock in production
- Build succeeds

## When to read specific references

| Reference | When to read |
|---|---|
| `references/integration-workflow.md` | First-time setup, choosing adapter, full integration |
| `references/initialization-and-lifecycle.md` | SDK init, Game Ready, Gameplay API, singleton |
| `references/advertising.md` | Fullscreen, rewarded, sticky banner, ad lifecycle |
| `references/events-pause-and-audio.md` | Platform events, pause reasons, audio handling |
| `references/player-auth-and-storage.md` | Player object, auth dialog, saves, stats, guest mode |
| `references/leaderboards.md` | Leaderboard API, deprecated vs current, limits |
| `references/purchases.md` | IAP, payments, consume, signature, catalog |
| `references/remote-config.md` | getFlags, default flags, client features |
| `references/localization-and-environment.md` | i18n.lang, environment, deviceInfo, clipboard |
| `references/server-time-and-device.md` | Server time, device info, daily rewards |
| `references/local-testing.md` | Dev proxy, dev vs prod env, debug panel, CSP |
| `references/moderation-requirements.md` | Official requirements, moderation checklist |
| `references/moderation-checklist.md` | Actionable checklists by category |
| `references/deprecated-api.md` | Deprecated methods, migration guide |
| `references/troubleshooting.md` | Common errors, solutions |

## Safe project modification rules

1. Never rewrite the entire game for SDK convenience
2. Never delete existing save files or localStorage keys
3. Never touch game mechanics (physics, scoring, level logic) unless they conflict with moderation requirements
4. When adding pause support, merge with existing pause; don't create a second pause system
5. When adding saves, version the schema and migrate old versions
6. Wrap the SDK in one adapter/service; do not scatter `ysdk.*` calls across 20 files
7. Never open auth dialog automatically on game start
8. Never give rewarded content outside `onRewarded` callback
9. Never mock SDK in production
10. Never use legacy loader `/games/sdk/v2/`

## Report format

After completing a task, produce:

```
## Yandex Games SDK — Report

### Changes made
[List of modified/created files]

### SDK methods integrated
[List]

### Adapter used
[Which adapter and why]

### Tests
[Which tests passed/failed]

### Audit results
[Summary of audit script output]

### Manual checks needed
[Items that require draft/debug panel verification]

### Commands for local testing
npx @yandex-games/sdk-dev-proxy -p ./dist --dev-mode=true
```

## Test commands

```bash
# Validate skill integrity (deep analysis: required files, adapter code quality,
# reference URLs, test coverage, rule coverage, legacy loader check, method consistency)
node .kilo/skills/yandex-games-sdk/scripts/validate-skill.mjs

# Run all unit tests covering all three adapters and audit rules
node --test .kilo/skills/yandex-games-sdk/tests/*.test.mjs

# Audit a game project for Yandex SDK compliance
node .kilo/skills/yandex-games-sdk/scripts/audit-yandex-integration.mjs <path>

# TypeScript typecheck (requires typescript@5.9.3 and @types/ysdk@1.2.0)
npx tsc --noEmit --strict
```

## Example activation prompts

```
Используй skill yandex-games-sdk и интегрируй Яндекс SDK в эту игру.
```

```
Проведи полный Yandex Games SDK audit проекта и исправь критические ошибки.
```

```
Подготовь эту Phaser 3 игру к модерации Яндекс Игр.
```

```
Добавь безопасную rewarded-рекламу и облачные сохранения через Yandex SDK.
```

```
Проверь интеграцию: нет ли устаревшего лоадера, Game Ready, паузы при рекламе.
```

```
Добавь лидерборды и авторизацию через Yandex SDK.
```
