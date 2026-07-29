# Moderation checklist

Source: https://yandex.ru/dev/games/doc/ru/concepts/requirements (2026-07-29)

## Static audit checks

- [ ] SDK loader is correct (/sdk.js or S3 URL, not legacy)
- [ ] SDK init occurs after script load
- [ ] No duplicate init calls
- [ ] Auth dialog not auto-opened on start
- [ ] No deprecated leaderboard API
- [ ] No deprecated player methods
- [ ] No mock in production code
- [ ] No external payment systems
- [ ] No secrets in client code
- [ ] No legacy SDK loader
- [ ] index.html in root
- [ ] No spaces/cyrillic in paths
- [ ] Archive size < 100 MB (if dist dir provided)

Static analysis is heuristic. Review every finding and complete the checks
below in the Yandex draft and debug panel.

## Semi-automatic checks (debug panel)

- [ ] Open game with `?debug-mode=16`
- [ ] Loader shows "IT" (not "IF")
- [ ] Game Ready indicator turns green
- [ ] I18n indicator shows green (SDK language used)
- [ ] Currency mock: enable and verify currency changes
- [ ] Network throttling: test slow connection
- [ ] Focus loss: verify pause/resume
- [ ] Gamepad button: verify gameplay start/stop reacts
- [ ] Clear cloud data: verify saves reset

## Manual checks

- [ ] Game works without auth (guest mode)
- [ ] Auth dialog explains benefits clearly
- [ ] Progress saves on critical points
- [ ] Sound stops on tab switch
- [ ] Sound stops during fullscreen ad
- [ ] Sound stops during rewarded ad
- [ ] Fullscreen ads only in logical pauses
- [ ] Rewarded is optional bonus, not required to progress
- [ ] Rewarded shows reward description before ad
- [ ] Sticky banner doesn't cover UI
- [ ] No browser scrollbar
- [ ] No swipe-to-refresh
- [ ] Mobile: fullscreen during gameplay
- [ ] Mobile: gesture controls work
- [ ] Mobile: no WebGL notification
- [ ] Mobile: no system player
- [ ] Desktop: keyboard/mouse control
- [ ] Desktop: no OS hotkey conflicts
- [ ] Desktop: active field stretches to edges (ratio max 2:1)
- [ ] IAP: portal currency from SDK
- [ ] IAP: consume method connected
- [ ] IAP: prices and descriptions match
- [ ] IAP: no external payment systems
- [ ] All chosen languages are localized
- [ ] Gameplay > 10 minutes
- [ ] Controls are explained
- [ ] No UI overlapping or cutoff
- [ ] No technical errors in console
- [ ] Complete, not in development
- [ ] Game Ready is called only after loading finishes
- [ ] GameplayAPI start/stop follows actual gameplay state
- [ ] GameplayAPI stop is active during ads
- [ ] Platform pause/resume events are handled

## Console checks

- [ ] Monetization (RSA) enabled
- [ ] IAP products configured if used
- [ ] Leaderboards created with correct technical names
- [ ] Sticky banner settings configured
- [ ] CSP configured (own domain only)
- [ ] Supported platforms and orientations match game
- [ ] Archive uploaded with correct structure
- [ ] Draft filled completely (all required fields)
- [ ] Promo materials show real gameplay
- [ ] Age rating matches content
- [ ] No copyright violations

> Note: Passing all checks reduces but does not guarantee passing moderation.
