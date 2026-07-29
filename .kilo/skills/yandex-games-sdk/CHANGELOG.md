# Changelog

## 1.2.0 (2026-07-29)

- Phaser adapter now pauses and resumes the exact same scene set and composes with `YandexPlatformService` under strict TypeScript
- YG-SDK-001 only accepts an SDK loader in an HTML entry point; YG-SDK-003 models normal, `async`, `defer`, and module script execution
- YG-SDK-007 inspects the isolated `onClose` body, avoiding callback-order false positives and recognizing common currency/state grants
- Audit tests remove all temporary projects, including the sparse 101 MB size fixture
- Исправлен контракт `getPlayer({ signed: true })`: возвращается `Signature`, а не `Player` или `null`
- Добавлена индивидуальная отписка от `onPause`/`onResume`; Phaser-адаптер отписывается в `destroy()`
- YG-SDK-019 теперь проверяет пути всех ресурсов, включая изображения и аудио
- YG-SDK-021 распознаёт обработку `YaGames.init()` через `try/catch`
- TypeScript-тест использует переносимую временную папку и не устанавливает зависимости во время теста
- Исправлены рекламные примеры и документация signed-player
- Чеклист разделяет статические, полуавтоматические и ручные проверки
- `validate-skill.mjs` выводит `PASS WITH WARNINGS` и поддерживает строгий режим `--strict`

## 1.1.0 (2026-07-29)

- **Adapters**: Все три адаптера теперь используют `{ callbacks: { ... } }` обёртку (совместимость с `@types/ysdk@1.2.0`)
- **Reward protection**: Добавлена защита от двойной выдачи награды (`rewardGiven` флаг с автосбросом)
- **try/catch**: Запуск рекламы обёрнут в try/catch — при исключении гарантированно снимается пауза и сбрасывается `adInProgress`
- **Destroy cleanup**: `destroy()` теперь очищает массивы `onPauseCallbacks`/`onResumeCallbacks` и обнуляет хендлеры — больше никаких висячих callbacks
- **Mock SDK**: Поддерживает оба формата callbacks: `{ callbacks: { ... } }` и плоский `{ onOpen, ... }`
- **YG-SDK-007**: Уровень `FAIL`, находит награду в многострочном `onClose`, включая формат с `callbacks: {}`
- **YG-SDK-006**: Считает баланс `start()`/`stop()`, а не просто ищет наличие stop; уровень `WARN`
- **YG-SDK-020**: Анализирует переданную директорию, не ищет внутри `dist/dist`
- **TypeScript-адаптер**: Исправлены типы `getPlayer` (обработка `Player | Signature`), `showBannerAdv` (stickyAdvIsShowing)
- **Тесты**: 66 тестов (было 50) — добавлены: callbacks-wrapper, rewardGiven, try/catch, destroy cleanup, multi-line YG-SDK-007, TS-компиляция через tsc, реальный исходник Phaser-адаптера
- **validate-skill**: Глубокий анализ: проверка качества кода адаптеров, покрытие правил тестами, URL референсов, размер файлов, консистентность методов
- **TypeScript typecheck**: Добавлена проверка TypeScript-адаптера через `tsc` с актуальным `@types/ysdk@1.2.0`

## 1.0.0 (2026-07-29)

- Initial release
- Official Yandex Games SDK documentation verified on 2026-07-29
- Adapters: Vanilla JS, TypeScript, Phaser 3
- Audit script with 15+ detection rules
- Unit tests for audit script with 15 fixture cases
- Mock SDK for development/testing
- Complete moderation checklist
- Deprecated API migration guide
