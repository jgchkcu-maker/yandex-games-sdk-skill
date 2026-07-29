# Moderation requirements

Source: https://yandex.ru/dev/games/doc/ru/concepts/requirements (2026-07-29)

## Technical (Section 1)

| ID | Requirement | Type |
|---|---|---|
| 1.1 | SDK must be embedded | Auto |
| 1.2 | No 3rd party auth required; Yandex ID allowed | Manual |
| 1.2.1 | Auth only after deliberate user action | Auto + Manual |
| 1.2.2 | Guest mode available, progress saved | Auto + Manual |
| 1.3 | Sound stops on tab hide | Auto |
| 1.4 | Payments only through Yandex SDK | Auto |
| 1.6 | Works on claimed platforms | Manual |
| 1.6.1.1 | Fullscreen on mobile | Manual |
| 1.6.1.3 | No distortion on orientation change | Manual |
| 1.6.1.5 | Touch/mobile-game controls by gestures | Manual |
| 1.6.2.4 | Keyboard/mouse controls on desktop | Manual |
| 1.6.3 | TV navigation support | Manual |
| 1.7 | No absolute S3 URLs in code | Auto |
| 1.8 | Elements sized for touch/click | Manual |
| 1.9 | Progress saves immediately | Auto + Manual |
| 1.10 | Correct display, no scroll | Manual |
| 1.10.1 | Elements not cut off | Manual |
| 1.10.2 | No browser scroll or swipe-to-refresh | Manual |
| 1.10.3 | No overlapping elements | Manual |
| 1.12 | Yandex ad network monetization enabled | Manual (Console) |
| 1.13.1 | Consume method connected for IAP | Auto |
| 1.13.2 | Portal currency from SDK (not hardcoded) | Auto (debug panel) |
| 1.13.3 | Cloud saves for IAP games | Manual |
| 1.14 | No technical errors, hangs, crashes | Manual |
| 1.15 | Complete, not in development | Manual |
| 1.16 | No ad block customization | Auto |
| 1.19.1 | SDK initialized per docs | Auto |
| 1.19.2 | Game Ready called | Auto |
| 1.19.3 | GameplayAPI consistent with docs | Auto |
| 1.19.4 | Platform events handled per docs | Auto |
| 1.21 | Archive size < 100 MB uncompressed | Auto |
| 1.22 | index.html in root, no spaces/cyrillic in paths | Auto |
| 1.24 | Updates keep core concept | Manual |

## User experience (Section 2)

| ID | Requirement | Type |
|---|---|---|
| 2.2 | Controls described | Manual |
| 2.6 | Save/replay option | Manual |
| 2.9 | Gameplay > 10 minutes | Manual |
| 2.10 | Localization for chosen languages | Manual |
| 2.14 | Auto language detection via SDK | Auto (debug panel) |

## Advertising (Section 4)

| ID | Requirement | Type |
|---|---|---|
| 4.1 | Ads only through Yandex SDK | Auto |
| 4.4 | Ads only in logical pauses | Auto |
| 4.5 | Rewarded is optional bonus | Auto |
| 4.5.2 | Reward is bonus, not required | Auto |
| 4.7 | Sound and gameplay paused during ads | Auto |

## Promo materials (Section 5)

| ID | Requirement | Type |
|---|---|---|
| 5.1.1.1 | No other games' gameplay in promos | Manual |
| 5.1.1.2 | Screenshots show real gameplay (70%+) | Manual |
