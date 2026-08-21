import { MESSAGE, STORAGE_KEY } from '../config.js'

const statusEl = document.getElementById('status')
const recheckBtn = document.getElementById('recheck')
const listEl = document.getElementById('list')
const idEl = document.getElementById('extension-id')

idEl.textContent = 'Extension ID: ' + chrome.runtime.id

function setStatus (kind, text) {
  statusEl.className = 'status ' + kind
  statusEl.textContent = text
}

function itemMeta (item) {
  const bits = []
  if (item.float) bits.push('float ' + item.float)
  if (item.paintIndex) bits.push('paint ' + item.paintIndex)
  if (item.nameTag) bits.push(item.nameTag)
  bits.push(item.assetId)
  return bits.join(' · ')
}

function renderGroup (title, items) {
  const section = document.createElement('section')
  section.className = 'group'

  const heading = document.createElement('h2')
  heading.textContent = title + ' (' + items.length + ')'
  section.appendChild(heading)

  if (!items.length) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'No items'
    section.appendChild(empty)
    return section
  }

  for (const item of items) {
    const article = document.createElement('article')
    if (item.iconUrl) {
      const img = document.createElement('img')
      img.src = item.iconUrl
      img.alt = item.name
      article.appendChild(img)
    } else {
      const placeholder = document.createElement('div')
      article.appendChild(placeholder)
    }

    const body = document.createElement('div')
    const name = document.createElement('h3')
    name.textContent = item.name
    const meta = document.createElement('p')
    meta.textContent = itemMeta(item)
    body.appendChild(name)
    body.appendChild(meta)
    article.appendChild(body)
    section.appendChild(article)
  }

  return section
}

function bagItems (group) {
  if (Array.isArray(group)) return group
  return group?.items || []
}

function renderSnapshot (snapshot) {
  listEl.replaceChildren()
  if (!snapshot) return

  if (snapshot.status === 'loading') {
    setStatus('checking', 'Fetching inventory and protected…')
    return
  }

  if (snapshot.status === 'error') {
    setStatus('bad', snapshot.error || 'Steam inventory fetch failed.')
    return
  }

  const who = snapshot.personaname || snapshot.steamId64 || 'Partner'
  const inventory = bagItems(snapshot.groups?.inventory)
  const protectedItems = bagItems(snapshot.groups?.protected)
  setStatus(
    'ok',
    who +
      ' · ' +
      inventory.length +
      ' inventory, ' +
      protectedItems.length +
      ' protected',
  )
  listEl.appendChild(renderGroup('Inventory', inventory))
  listEl.appendChild(renderGroup('Trade protected', protectedItems))
}

async function checkSession () {
  setStatus('checking', 'Checking Steam session…')
  try {
    const result = await chrome.runtime.sendMessage({ type: MESSAGE.GET_SESSION })
    if (!result?.ok && result?.error) {
      setStatus('bad', result.error)
      return
    }
    if (!result?.loggedIn) {
      setStatus('bad', 'Log into Steam first in this Chrome profile.')
      return
    }

    const snap = await chrome.runtime.sendMessage({ type: MESSAGE.GET_SNAPSHOT })
    if (snap?.snapshot) {
      renderSnapshot(snap.snapshot)
      return
    }
    setStatus('ok', 'Steam session is active. Open a user in office to load inventory.')
  } catch (error) {
    setStatus('bad', String(error?.message || error))
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return
  renderSnapshot(changes[STORAGE_KEY].newValue)
})

recheckBtn.addEventListener('click', () => {
  checkSession()
})

checkSession()
