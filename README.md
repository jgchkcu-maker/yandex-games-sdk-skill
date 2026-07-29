# Yandex Games SDK — Kilo Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-blue)]()
[![Yandex Games](https://img.shields.io/badge/platform-Yandex%20Games-red)]()

Skill для [Kilo Code](https://kilo.ai): интеграция, аудит, отладка и подготовка HTML5-игр для платформы [Яндекс Игр](https://yandex.ru/games/).

## Установка

```bash
# Клонировать репозиторий
git clone https://github.com/jgchkcu-maker/yandex-games-sdk-skill.git

# Добавить в kilo.json проекта:
# {
#   "skills": {
#     "paths": ["./skills"]
#   }
# }
```

Или просто откройте проект в Kilo — `skills.paths` уже настроен.

## Возможности

| Возможность | Описание |
|---|---|
| **Интеграция SDK** | Адаптеры под Vanilla JS / TypeScript / Phaser 3 |
| **Реклама** | Fullscreen, rewarded video, sticky banner |
| **Авторизация** | Гость / авторизованный режим |
| **Сохранения** | Облачные, статистика игрока |
| **Лидерборды** | Актуальное API |
| **Покупки** | IAP, потребляемые товары |
| **Game Ready** | LoadingAPI / GameplayAPI |
| **Аудит** | Проверка соответствия требованиям |
| **Модерация** | Чек-листы для публикации |

## Структура

```
skills/yandex-games-sdk/
├── SKILL.md                                # Инструкции skill (точка входа)
├── assets/                                 # Адаптеры и моки
│   ├── vanilla-js-adapter.js
│   ├── typescript-adapter.ts
│   ├── phaser-adapter.ts
│   └── mock-yandex-sdk.ts
├── references/                             # Документация по SDK (16 файлов)
├── scripts/                                # Инструменты аудита
│   ├── audit-yandex-integration.mjs
│   └── validate-skill.mjs
└── tests/                                  # Тесты и фикстуры
    ├── adapters.test.mjs
    ├── audit-yandex-integration.test.mjs
    ├── validate-skill.test.mjs
    └── fixtures/                           # 11 тестовых проектов
```

## Быстрый старт

```bash
# Аудит игры
node skills/yandex-games-sdk/scripts/audit-yandex-integration.mjs ./dist

# Тесты
node --test skills/yandex-games-sdk/tests/*.test.mjs

# Валидация skill
node skills/yandex-games-sdk/scripts/validate-skill.mjs

# Локальное тестирование
npx @yandex-games/sdk-dev-proxy -p ./dist --dev-mode=true
```

## Использование

В чате с Kilo напишите:

> Используй skill yandex-games-sdk и интегрируй Яндекс SDK в эту игру.

Или:

> Проведи полный Yandex Games SDK audit проекта и исправь критические ошибки.

## Адаптеры

| Проект | Файл |
|---|---|
| Vanilla JS | `assets/vanilla-js-adapter.js` |
| Vite / TypeScript | `assets/typescript-adapter.ts` |
| Phaser 3 | `assets/phaser-adapter.ts` |

## Лицензия

MIT
