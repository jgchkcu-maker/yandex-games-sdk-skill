# Purchases (IAP)

Source: https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases (2026-07-29)

## Initialization

```javascript
// Direct access (lazy init)
const payments = ysdk.payments;

// Pre-load (faster first call)
const payments = await ysdk.getPayments();
// or with signed: true
const payments = await ysdk.getPayments({ signed: true });
```

`signed: true` is for server-side processing. On client-side, omit or use `signed: false`.

## Methods

### payments.purchase()
```typescript
function purchase({ id: string, developerPayload?: string }): Promise<IPurchase | ISign>
```
- Opens payment frame
- `id` is the product ID from Dev Console
- `developerPayload` is optional extra info for your server
- Promise resolves on success, rejects on cancel/error

### payments.getPurchases()
```typescript
function getPurchases(): Promise<IPurchase[] | ISign>
```
Returns list of all purchases (including unconsumed consumables).

### payments.getCatalog()
```typescript
function getCatalog(): Promise<IProduct[]>
```
Returns available products with id, title, description, imageURI, price, priceValue, priceCurrencyCode, getPriceCurrencyImage.

### payments.consumePurchase()
```typescript
function consumePurchase(purchaseToken: string): Promise<void>
```
- Consumes a purchase (removes it)
- IMPORTANT: credit the player FIRST, THEN consume
- Consumed purchases cannot be restored

## Processing flow

1. Call `payments.purchase({ id: 'product_id' })`
2. On success, credit the item/currency to the player
3. Call `payments.consumePurchase(purchaseToken)` for consumables
4. For non-consumables (e.g., remove ads), just check via `getPurchases()`

## Checking unconsumed purchases (REQUIRED for moderation)

Check on every game start:
```javascript
const purchases = await ysdk.payments.getPurchases();
for (const purchase of purchases) {
    // credit the item
    await creditItem(purchase.productID);
    // then consume
    await ysdk.payments.consumePurchase(purchase.purchaseToken);
}
```

## Signature-based verification (server-side)

```javascript
const ysdk = await YaGames.init({ signed: true });
const purchase = await ysdk.payments.purchase({ id: 'gold500' });
// Send purchase.signature to your server
await fetch('https://your.server/verify', { method: 'POST', body: purchase.signature });
```

DO NOT store secret keys in client code.

## Portal currency

- Always get name and icon from SDK catalog (`getCatalog()`)
- Do NOT hardcode currency display
- Use `product.getPriceCurrencyImage('small' | 'medium' | 'svg')` for currency icon
