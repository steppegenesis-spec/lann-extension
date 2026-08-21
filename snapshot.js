import { STORAGE_KEY } from './config.js'

export async function readSnapshot () {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  return stored[STORAGE_KEY] ?? null
}

export async function writeSnapshot (snapshot) {
  await chrome.storage.local.set({ [STORAGE_KEY]: snapshot })
}

export async function setBadge (text, color) {
  await chrome.action.setBadgeBackgroundColor({ color })
  await chrome.action.setBadgeText({ text })
}
