# Remote Config

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-config (2026-07-29)

## Getting flags

```typescript
interface IFlags { [key: string]: string }
interface IClientFeature { name: string; value: string }
interface IGetFlagsParams {
    defaultFlags?: IFlags;
    clientFeatures?: IClientFeature[];
}
function getFlags(getFlagsParams?: IGetFlagsParams): Promise<IFlags>
```

## Usage

```javascript
const flags = await ysdk.getFlags();
// or with defaults
const flags = await ysdk.getFlags({ defaultFlags: { difficulty: 'normal' } });
// or with client features
const flags = await ysdk.getFlags({
    defaultFlags: { difficulty: 'normal' },
    clientFeatures: [{ name: 'payingStatus', value: player.getPayingStatus() }]
});
```

## Rules

- Request once at game start
- Always provide `defaultFlags` (local fallback)
- If network fails, defaults are used — game must not crash
- Values are strings (per current official docs)
- Unknown flags should be ignored, not crash
- Remote flags override defaults
- Client features can be used for targeted config (e.g., different difficulty for paying users)
