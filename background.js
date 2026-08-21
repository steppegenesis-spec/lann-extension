import { CONTEXT_ID, MESSAGE, isAllowedExternalOrigin, parseTradeUrl, steamId64FromAccountId } from './config.js'
import { flattenBag } from './inventoryItems.js'
import { readSnapshot, setBadge, writeSnapshot } from './snapshot.js'
import { fetchBagPage } from './steamClient.js'
import { getSteamSession } from './steamSession.js'

function emptyGroup () {
  return { items: [], more: false, moreStart: null }
}

function mergeItems (existing, incoming) {
  const seen = new Set(existing.map((item) => item.assetId))
  const next = existing.slice()
  for (const item of incoming) {
    if (seen.has(item.assetId)) continue
    seen.add(item.assetId)
    next.push(item)
  }
  return next
}

function bagCount (snapshot) {
  const inventory = snapshot?.groups?.inventory?.items?.length || 0
  const protectedCount = snapshot?.groups?.protected?.items?.length || 0
  return inventory + protectedCount
}

async function requireSessionAndTrade (message) {
  const trade = parseTradeUrl(message?.tradeUrl || '')
  if (!trade) {
    return { ok: false, error: 'invalid_trade_url' }
  }

  const session = await getSteamSession()
  if (!session.loggedIn || !session.sessionid) {
    return { ok: false, error: 'not_logged_in' }
  }

  const steamId64 = /^\d{17}$/.test(message.steamId64 || '')
    ? message.steamId64
    : steamId64FromAccountId(trade.accountId)

  return {
    ok: true,
    sessionid: session.sessionid,
    steamId64,
    tradeUrl: trade.href,
    personaname: String(message.personaname || ''),
  }
}

async function loadBagPage ({ sessionid, steamId64, tradeUrl, bag, start }) {
  const contextId = CONTEXT_ID[bag]
  const fetched = await fetchBagPage({
    sessionid,
    steamId64,
    tradeUrl,
    contextId,
    start,
  })
  return {
    items: flattenBag(fetched.page, bag),
    more: fetched.more,
    moreStart: fetched.moreStart,
  }
}

async function loadInventory (message) {
  const auth = await requireSessionAndTrade(message)
  if (!auth.ok) return auth

  const { sessionid, steamId64, tradeUrl, personaname } = auth

  await writeSnapshot({
    status: 'loading',
    steamId64,
    personaname,
    groups: { inventory: emptyGroup(), protected: emptyGroup() },
  })
  await setBadge('…', '#8b98a5')

  try {
    const inventory = await loadBagPage({
      sessionid,
      steamId64,
      tradeUrl,
      bag: 'inventory',
      start: null,
    })
    const protectedBag = await loadBagPage({
      sessionid,
      steamId64,
      tradeUrl,
      bag: 'protected',
      start: null,
    })
    const snapshot = {
      status: 'ready',
      steamId64,
      personaname,
      fetchedAt: Date.now(),
      groups: { inventory, protected: protectedBag },
    }
    await writeSnapshot(snapshot)
    await setBadge(String(Math.min(bagCount(snapshot), 999)), '#47a432')
    return {
      ok: true,
      steamId64,
      inventoryCount: inventory.items.length,
      protectedCount: protectedBag.items.length,
      inventoryMore: inventory.more,
      protectedMore: protectedBag.more,
    }
  } catch (error) {
    const text = String(error?.message || error)
    await writeSnapshot({
      status: 'error',
      steamId64,
      personaname,
      error: text,
      groups: { inventory: emptyGroup(), protected: emptyGroup() },
    })
    await setBadge('!', '#c45c4a')
    return { ok: false, error: text }
  }
}

async function loadInventoryPage (message) {
  const bag = message?.bag === 'protected' ? 'protected' : message?.bag === 'inventory' ? 'inventory' : null
  if (!bag) {
    return { ok: false, error: 'invalid_bag' }
  }

  const auth = await requireSessionAndTrade(message)
  if (!auth.ok) return auth

  const { sessionid, steamId64, tradeUrl, personaname } = auth
  const current = (await readSnapshot()) || {
    status: 'ready',
    steamId64,
    personaname,
    groups: { inventory: emptyGroup(), protected: emptyGroup() },
  }

  const start = message.start == null ? null : Number(message.start)
  if (start != null && !Number.isFinite(start)) {
    return { ok: false, error: 'invalid_start' }
  }

  await writeSnapshot({ ...current, loadingBag: bag })

  try {
    const page = await loadBagPage({
      sessionid,
      steamId64,
      tradeUrl,
      bag,
      start,
    })
    const previous = current.groups?.[bag] || emptyGroup()
    const snapshot = {
      ...current,
      status: 'ready',
      steamId64,
      personaname,
      loadingBag: null,
      fetchedAt: Date.now(),
      groups: {
        inventory: current.groups?.inventory || emptyGroup(),
        protected: current.groups?.protected || emptyGroup(),
        [bag]: {
          items: mergeItems(previous.items || [], page.items),
          more: page.more,
          moreStart: page.moreStart,
        },
      },
    }
    await writeSnapshot(snapshot)
    await setBadge(String(Math.min(bagCount(snapshot), 999)), '#47a432')
    return {
      ok: true,
      bag,
      more: page.more,
      moreStart: page.moreStart,
      count: snapshot.groups[bag].items.length,
    }
  } catch (error) {
    const text = String(error?.message || error)
    await writeSnapshot({ ...current, loadingBag: null, error: text })
    return { ok: false, error: text }
  }
}

function dispatch (message, sendResponse) {
  if (message?.type === MESSAGE.GET_SESSION) {
    getSteamSession().then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) })
    })
    return true
  }

  if (message?.type === MESSAGE.GET_SNAPSHOT) {
    readSnapshot().then((snapshot) => {
      sendResponse({ ok: true, snapshot })
    }).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) })
    })
    return true
  }

  if (message?.type === MESSAGE.LOAD_INVENTORY) {
    loadInventory(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) })
    })
    return true
  }

  if (message?.type === MESSAGE.LOAD_INVENTORY_PAGE) {
    loadInventoryPage(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) })
    })
    return true
  }

  sendResponse({ ok: false, error: 'unknown_type' })
  return false
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  return dispatch(message, sendResponse)
})

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isAllowedExternalOrigin(sender.origin)) {
    sendResponse({ ok: false, error: 'origin_not_allowed' })
    return
  }
  return dispatch(message, sendResponse)
})
