# Lann Back-Office Steam Tool

Internal Chrome extension. It reads the staff member’s Steam community cookies from this Chrome profile so the Lann back-office can load a user’s CS2 inventory. Treat it like a credentialed tool, not a public product.

## Load unpacked (dev loop)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder (`lann-extension`)
4. Pin the extension, open the popup, confirm session status
5. Copy the **Extension ID** shown in the popup into `office-lann-v3/.env`:

```bash
VITE_LANN_EXTENSION_ID=abcdefghijklmnopqrstuvwxyzabcdef
```

6. Restart `yarn dev` in office-lann-v3
7. Log into [steamcommunity.com](https://steamcommunity.com) in **the same Chrome profile**
8. Open a user in office that has a trade URL — the popup lists **Inventory** (context 2) and **Protected** (context 16)

After JS changes: **Reload** on the extension card, then reopen the popup. Click **service worker** on the extension card for background logs.

## Flow

1. `UserDetailLayout` loads the user and reads `tradeURL`
2. Office sends `STEAM_LOAD_INVENTORY` to this extension
3. The extension fetches both bags from `/tradeoffer/new/partnerinventory/`
4. The popup renders one list with Inventory and Protected groups

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Read Steam community session cookies |
| `host_permissions` for `steamcommunity.com` | Partner-inventory fetch |
| `declarativeNetRequestWithHostAccess` | Set Steam Referer (fetch cannot) |
| `storage` | Last inventory snapshot for the popup |
| `tabs` | Reserved for page-context fetches later |
