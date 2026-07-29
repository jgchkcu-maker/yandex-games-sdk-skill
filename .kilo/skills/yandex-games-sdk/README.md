# Yandex Games SDK — Agent Skill

Integrate, audit, debug, and prepare HTML5 games for the Yandex Games platform.

## Structure

```
.kilo/skills/yandex-games-sdk/
├── SKILL.md                    # Main skill instructions
├── README.md                   # This file
├── CHANGELOG.md                # Version history
├── references/                 # Domain references (loaded on demand)
├── assets/                     # Adapters, mock SDK, example HTML
├── scripts/                    # Audit and validation scripts
└── tests/                      # Audit tests and fixtures
```

## Quick start

```bash
# Run audit on a game project
node .kilo/skills/yandex-games-sdk/scripts/audit-yandex-integration.mjs ./dist

# Run audit tests
node --test .kilo/skills/yandex-games-sdk/tests/*.test.mjs

# Validate skill itself
node .kilo/skills/yandex-games-sdk/scripts/validate-skill.mjs
```

## Local testing with SDK Dev Proxy

```bash
# Dev environment (mocked)
npx @yandex-games/sdk-dev-proxy -p ./dist --dev-mode=true

# Production-like (requires app ID)
npx @yandex-games/sdk-dev-proxy -p ./dist --app-id=<APP_ID>
```

## Debug panel

```
https://yandex.ru/games/app/<APP_ID>?debug-mode=16
```

## Sources verified

All references verified against official Yandex Games SDK documentation on 2026-07-29.
