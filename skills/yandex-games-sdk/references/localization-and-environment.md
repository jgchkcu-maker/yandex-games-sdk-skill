# Localization and environment

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment (2026-07-29)

## Language

Always use SDK for language detection, NOT `navigator.language`:
```javascript
const lang = ysdk.environment.i18n.lang; // 'ru', 'en', 'tr', etc.
```

Rules:
- Language is ISO 639-1 format
- This is the ONLY reliable source for the platform language (requirement 2.14)
- Add fallback for unsupported languages
- Normalize codes if needed (e.g., map 'en' → 'en-US')
- Check all listed languages in draft are covered

## Environment object

```javascript
ysdk.environment.app.id;      // game ID
ysdk.environment.i18n.lang;   // current language
ysdk.environment.payload;     // optional URL parameter
ysdk.environment.referrer;    // promo referral data (optional)
```

## Referrer (promo campaigns)

```javascript
const { referrer } = ysdk.environment;
if (referrer?.type === 'promo') {
    if (referrer.inappId) {
        showPurchaseScreen(referrer.inappId);
    } else if (referrer.intent) {
        openScreen(referrer.intent);
    }
}
```

## Device info

```typescript
ysdk.deviceInfo.type; // 'desktop' | 'mobile' | 'tablet' | 'tv'
ysdk.deviceInfo.isMobile();
ysdk.deviceInfo.isDesktop();
ysdk.deviceInfo.isTablet();
ysdk.deviceInfo.isTV();
```

## Other params

```typescript
ysdk.screen.fullscreen.request();
ysdk.screen.fullscreen.exit();
ysdk.screen.fullscreen.status; // 'on' | 'off'

ysdk.clipboard.writeText(text);
```
