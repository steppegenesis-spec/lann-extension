import { STEAM_COMMUNITY_URL } from './config.js'

/**
 * Read the Steam community cookies from this Chrome profile.
 * Never returns steamLoginSecure — that value is a live session token.
 */
export async function getSteamSession () {
  const [sessionid, loginSecure] = await Promise.all([
    chrome.cookies.get({ url: STEAM_COMMUNITY_URL, name: 'sessionid' }),
    chrome.cookies.get({ url: STEAM_COMMUNITY_URL, name: 'steamLoginSecure' }),
  ])

  const loggedIn = Boolean(sessionid?.value && loginSecure?.value)

  return {
    ok: true,
    loggedIn,
    sessionid: loggedIn ? sessionid.value : null,
    loginSecure: loggedIn,
  }
}
