import {
  CONTEXT_ID,
  CS2_APP_ID,
  REFERER_RULE_ID,
  STEAM_COMMUNITY_URL,
} from './config.js'

async function setPartnerReferer (referer) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REFERER_RULE_ID],
    addRules: [
      {
        id: REFERER_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: referer },
            { header: 'Origin', operation: 'set', value: STEAM_COMMUNITY_URL },
          ],
        },
        condition: {
          urlFilter: '||steamcommunity.com/tradeoffer/new/partnerinventory',
          resourceTypes: ['xmlhttprequest', 'other'],
        },
      },
    ],
  })
}

function inventoryUrl (sessionid, steamId64, contextId, start) {
  const params = new URLSearchParams({
    sessionid,
    partner: steamId64,
    appid: CS2_APP_ID,
    contextid: contextId,
    l: 'english',
  })
  if (start != null) params.set('start', String(start))
  return `${STEAM_COMMUNITY_URL}/tradeoffer/new/partnerinventory/?${params}`
}

function pageCursor (page) {
  if (!page || !page.more) return null
  const start = page.more_start
  if (start === false || start == null || start === '') return null
  const numeric = Number(start)
  return Number.isFinite(numeric) ? numeric : null
}

async function fetchPage (url) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json, text/javascript;q=0.9, */*;q=0.8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Steam HTTP ${res.status}`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error('Steam returned a login wall instead of JSON. Log into steamcommunity.com in this profile.')
  }
}

export async function fetchBagPage ({ sessionid, steamId64, tradeUrl, contextId, start }) {
  await setPartnerReferer(tradeUrl)
  const page = await fetchPage(inventoryUrl(sessionid, steamId64, contextId, start))
  return {
    page,
    more: Boolean(page.more),
    moreStart: pageCursor(page),
  }
}
