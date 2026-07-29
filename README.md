# Yandex Games SDK — Kilo Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-blue)]()
[![Yandex Games](https://img.shields.io/badge/platform-Yandex%20Games-red)]()

> Интеграция, аудит, отладка и подготовка HTML5-игр для платформы Яндекс Игр.
> Работает как skill для [Kilo Code](https://kilo.ai).

## Возможности

- **Интеграция Yandex SDK** — подключение SDK, инициализация, адаптеры под Vanilla JS / TypeScript / Phaser 3
- **Реклама** — fullscreen, rewarded video, sticky banner с корректной обработкой жизненного цикла
- **Авторизация и сохранения** — гость/авторизованный режим, облачные сохранения, статистика игрока
- **Лидерборды** — актуальное API (без устаревших методов)
- **Покупки** — IAP, потребляемые/непотребляемые товары, каталог
- **Game Ready** — разметка геймплея, LoadingAPI / GameplayAPI
- **Аудит** — проверка интеграции на соответствие требованиям Яндекс Игр
- **Модерация** — подготовка к публикации, чек-листы

## Быстрый старт

```bash
# Запустить аудит игры
node .kilo/skills/yandex-games-sdk/scripts/audit-yandex-integration.mjs ./dist

# Запустить тесты
node --test .kilo/skills/yandex-games-sdk/tests/*.test.mjs

# Локальное тестирование (dev-режим)
npx @yandex-games/sdk-dev-proxy -p ./dist --dev-mode=true
```

## Структура

```
.kilo/skills/yandex-games-sdk/
├── SKILL.md                    # Инструкции skill
├── assets/                     # Адаптеры, мок SDK, примеры HTML
│   ├── vanilla-js-adapter.js
│   ├── typescript-adapter.ts
│   ├── phaser-adapter.ts
│   ├── mock-yandex-sdk.ts
│   └── example-*.html
├── references/                 # Документация (загружается по требованию)
│   ├── integration-workflow.md
│   ├── advertising.md
│   ├── player-auth-and-storage.md
│   ├── leaderboards.md
│   ├── purchases.md
│   └── ...
├── scripts/                    # Скрипты аудита и валидации
│   ├── audit-yandex-integration.mjs
│   └── validate-skill.mjs
└── tests/                      # Тесты и фикстуры
    ├── adapters.test.mjs
    ├── audit-yandex-integration.test.mjs
    └── fixtures/
```

## Адаптеры

| Проект | Адаптер |
|---|---|
| Vanilla JS (один HTML/JS) | `vanilla-js-adapter.js` |
| Vite / TypeScript | `typescript-adapter.ts` |
| Phaser 3 | `phaser-adapter.ts` |

## Использование в Kilo

Просто напишите в чат с Kilo:

> Используй skill yandex-games-sdk и интегрируй Яндекс SDK в эту игру.

Или:

> Проведи полный Yandex Games SDK audit проекта и исправь критические ошибки.

## Лицензия

MIT
