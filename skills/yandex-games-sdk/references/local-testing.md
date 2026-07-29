# Local testing

Source: https://yandex.ru/dev/games/doc/ru/concepts/local-launch (2026-07-29)
Source: https://yandex.ru/dev/games/doc/ru/console/debug-panel (2026-07-29)

## SDK Dev Proxy

```bash
# Dev environment (mocked, no registration needed)
npx @yandex-games/sdk-dev-proxy -p ./dist --dev-mode=true

# Production-like environment (requires app ID)
npx @yandex-games/sdk-dev-proxy -p ./dist --app-id=<APP_ID>
```

### Parameters

| Parameter | Description |
|---|---|
| `-h, --host <host>` | Host of local game server |
| `-p, --path <path>` | Path to game resources |
| `--port <port>` | Port (default 8080) |
| `-i, --app-id <id>` | Draft game ID |
| `-c, --csp` | Add CSP meta tag |
| `--tld <domain>` | Change yandex.tld (default ru) |
| `--dev-mode <bool>` | true = dev (mocked), false = prod (default) |

### Dev environment features

- No registration or draft required
- Opens at `localhost`
- SDK calls are mocked
- Ads show placeholders (callbacks work normally)
- Auth uses mock browser dialog
- Data saved to localStorage
- Catalog loaded from `purchases-catalog.json`
- URL params for mocks: `?mocks={"isAuthorized":true}`

### Prod environment features

- Opens on real `yandex.ru/games` address
- Real ads shown
- Real auth via Yandex Passport
- Real server data
- CSP must be configured in console

## Mock URL parameters

```text
localhost:8080?mocks={"canShowPrompt":true,"isAuthorized":true,"lockedOrientation":"landscape"}
```

## Local catalog file

Create `purchases-catalog.json` in project root:
```json
[
    {
        "id": "avatar",
        "title": "Premium avatar",
        "description": "Well styled modern avatar image",
        "imageURI": "{path-to-image}",
        "price": "100 RUB",
        "priceValue": "100",
        "priceCurrencyCode": "RUB"
    }
]
```

## Debug panel

```
https://yandex.ru/games/app/<APP_ID>?debug-mode=16
```

The debug panel provides:
- **Loader indicator**: IT = correct, IF = legacy loader
- **Game Ready indicator**: green = called, red = timeout (90s), purple = waiting
- **Language tool**: test different languages
- **Game links mock**: verify no external links
- **Focus tool**: simulate tab switch
- **Network throttling**: test slow connections
- **Currency mock**: verify dynamic currency
- **Cloud data clear**: reset saves
- **I18n indicator**: green = SDK language used, red = not used
- **Gamepad**: simulate GameplayAPI start/stop
- **Play button**: simulate platform pause/resume events
- **Clock**: toggle loader transparency

## Limitations

Local unit tests do NOT replace draft verification. Always verify:
- Real ads work correctly in prod environment
- Auth flows work end-to-end
- Saves persist across sessions
- Leaderboards show correct data
- Purchases process correctly
