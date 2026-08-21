# Lann Back-Office Steam Tool

Chrome extension that lets the React back-office use a staff member’s logged-in Steam session for inventory, pricing, and trade lookups. Internal tool, not a public product.

---

## Phase 1: Scope and setup

Define exact use cases. List precisely which Steam actions the back-office needs (for example inventory lookup, item pricing, trade offer status, account verification). This determines which endpoints and permissions you need. Do not request broad permissions you will not use — Chrome Web Store review flags that.

**Register the extension shell**

- Create the folder structure: `manifest.json`, `background.js`, `popup/` or `panel/`, `content-scripts/`
- Use Manifest V3
- Add an icon set (16 / 48 / 128px)
- Set up the dev loop: load unpacked in `chrome://extensions`, keep DevTools open on the service worker for background logs

---

## Phase 2: Manifest and permissions

```json
{
  "manifest_version": 3,
  "name": "Lann Back-Office Steam Tool",
  "version": "0.1.0",
  "permissions": ["cookies", "storage", "tabs"],
  "host_permissions": [
    "https://steamcommunity.com/*",
    "https://api.steampowered.com/*"
  ],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" },
  "externally_connectable": {
    "matches": ["https://your-backoffice-domain.mn/*"]
  }
}
```

Only add `content_scripts` matching `steamcommunity.com` if you go with Method A (page-context fetch) rather than pure cookie-reading from the background worker.

---

## Phase 3: Steam session access layer

Build a cookie-access helper in `background.js`:

```js
async function getSteamSession() {
  const sessionid = await chrome.cookies.get({
    url: 'https://steamcommunity.com',
    name: 'sessionid',
  })
  const loginSecure = await chrome.cookies.get({
    url: 'https://steamcommunity.com',
    name: 'steamLoginSecure',
  })
  return { sessionid: sessionid?.value, loginSecure: !!loginSecure }
}
```

Add a “logged in?” check the popup can call before attempting any action. Surface a clear “Log into Steam first” state in the UI instead of failing silently.

Decide per-endpoint: cookie-only vs explicit `sessionid`. Test each Steam endpoint you need and note which ones require `sessionid` as a POST field vs which work purely via the cookie header.

---

## Phase 4: API call layer

Write a thin Steam API client module (`steamClient.js`) with one function per action, for example:

- `getInventory(steamId, appId)`
- `getMarketPrice(itemName)`
- `checkTradeStatus(tradeId)`

Route requests through the right context:

- Simple GETs with cookie auth → straight from `background.js` with `credentials: 'include'`
- Actions needing `sessionid` in the body, or endpoints picky about referrer/origin → inject via content script on an open `steamcommunity.com` tab instead

Handle the common failure modes:

- not logged in
- session expired
- rate-limited (Steam throttles aggressively)
- CAPTCHA challenge pages returned instead of JSON

---

## Phase 5: Bridge to the React back-office

Implement the `externally_connectable` handshake so the React app can detect install status and talk to the extension (`onMessageExternal` / `sendMessage`).

Design a simple message protocol, for example:

```js
{ type: 'STEAM_GET_INVENTORY', steamId: '...', appId: 730 }
{ type: 'STEAM_CHECK_TRADE', tradeId: '...' }
```

Build the popup/panel UI, or skip it entirely and drive everything from the React app via messaging if the extension is just a session bridge with no standalone UI.

Return results to React and render there. Keeps back-office UI and logic in one codebase instead of duplicating them in the extension.

---

## Phase 6: Rate limiting and reliability

- Add a request queue with delay/backoff. Steam bans/throttles IPs and sessions that hit endpoints too fast, especially market and inventory endpoints.
- Cache read-heavy data (item prices, inventory snapshots) in `chrome.storage.local` with a TTL, so repeated back-office lookups do not re-hit Steam every time.
- Log failures server-side or to the React app so you can see patterns (for example session expiring every N hours) instead of debugging blind.

---

## Phase 7: Security review

- Scope `host_permissions` as tightly as possible — only the Steam domains you actually call, not `<all_urls>`.
- Validate the origin on every `onMessageExternal` call. Do not trust `sender.origin` blindly if you widen `externally_connectable` later; explicitly check it matches the back-office domain.
- Decide who is allowed to use this. It acts on a real logged-in Steam session, so only vetted back-office staff should install it. Treat it like a credentialed internal tool, not a public utility.
- Review against Steam’s ToS for the specific actions in scope. Read-only lookups are low-risk; automated trading/market actions carry account-limitation risk.

---

## Phase 8: Distribution

- Publish as **Unlisted** on the Chrome Web Store so you get auto-updates without a public listing.
- Add the install-detection banner in the React back-office so staff without the extension get a direct install link.
- Write a short internal README: what permissions it needs, why, and how to verify it is working (for example a “test connection” button that pings Steam and reports session status).

---

## Phase 9: Test and iterate

- Test with a real staff Steam login, not just your own. Confirm cookie access works cross-account.
- Test session-expiry handling: log out of Steam mid-session and confirm the extension surfaces a clear re-login prompt rather than throwing a raw error.
- Roll out to a small group first, watch for rate-limit issues, then expand.
