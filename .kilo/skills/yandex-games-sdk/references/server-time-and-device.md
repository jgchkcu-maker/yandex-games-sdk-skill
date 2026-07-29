# Server time and device

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time (2026-07-29)
Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-params (2026-07-29)

## Server time

```javascript
const serverTime = ysdk.serverTime(); // milliseconds, like Date.now()
```

Benefits:
- Protects against clock manipulation cheating
- Consistent across all devices
- Useful for daily rewards, timed events, leaderboards

### Daily reward example (24h cooldown)

```javascript
const currentTime = ysdk.serverTime();
const lastRewardTime = data.lastRewardTime || 0;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

if (currentTime - lastRewardTime >= DAY_IN_MS) {
    await giveReward();
    await player.setData({ lastRewardTime: currentTime });
}
```

### Calendar day reward (reset at UTC midnight)

```javascript
const currentDate = new Date(ysdk.serverTime()).toISOString().split('T')[0];
if (currentDate !== data.lastRewardDate) {
    await giveReward();
    await player.setData({ lastRewardDate: currentDate });
}
```

## Device info

```javascript
ysdk.deviceInfo.type;        // 'desktop' | 'mobile' | 'tablet' | 'tv'
ysdk.deviceInfo.isMobile();  // boolean
ysdk.deviceInfo.isDesktop(); // boolean
ysdk.deviceInfo.isTablet();  // boolean
ysdk.deviceInfo.isTV();      // boolean
```

Use for:
- Adapting UI layout per device type
- Enabling/disabling touch controls
- TV-specific navigation handling
