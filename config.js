export const STEAM_COMMUNITY_URL = 'https://steamcommunity.com'
export const STEAMID64_BASE = 76561197960265728n
export const CS2_APP_ID = '730'

export const CONTEXT_ID = {
  inventory: '2',
  protected: '16',
}

/** Origins allowed to talk to this extension via chrome.runtime.sendMessage.
 *  Keep in sync with externally_connectable.matches in manifest.json. */
export const ALLOWED_EXTERNAL_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://192.168.1.100:8081',
  'https://office.dev.lann.market',
  'https://office.lann.market',
]

export const MESSAGE = {
  GET_SESSION: 'STEAM_GET_SESSION',
  LOAD_INVENTORY: 'STEAM_LOAD_INVENTORY',
  LOAD_INVENTORY_PAGE: 'STEAM_LOAD_INVENTORY_PAGE',
  GET_SNAPSHOT: 'STEAM_GET_SNAPSHOT',
}

export const STORAGE_KEY = 'partnerInventory'

export const REFERER_RULE_ID = 1

export function isAllowedExternalOrigin (origin) {
  return ALLOWED_EXTERNAL_ORIGINS.includes(origin)
}

export function steamId64FromAccountId (accountId) {
  return String(STEAMID64_BASE + BigInt(accountId))
}

export function parseTradeUrl (value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (
    url.hostname !== 'steamcommunity.com' ||
    !url.pathname.startsWith('/tradeoffer/new')
  ) {
    return null
  }

  const partner = url.searchParams.get('partner')
  if (!partner || !/^\d+$/.test(partner)) return null

  return {
    accountId: partner,
    token: url.searchParams.get('token') || '',
    href: url.toString(),
  }
}
