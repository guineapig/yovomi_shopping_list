import { callYuvomi, cookiePairsOnly, normalizeServerUrl, YuvomiProxyError } from '../../utils/yuvomi'
import { mintDeviceCredential } from '../../utils/device'

/**
 * Step 1 of signing in. Exchanges username/password for either a finished
 * device credential, or - when two-factor authentication is on - a pending
 * session cookie the client must round-trip, opaquely, to /api/auth/verify-2fa.
 */
export default defineEventHandler(async (event) => {
  const { serverUrl: rawServerUrl, username, password } = await readBody<{
    serverUrl: string
    username: string
    password: string
  }>(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Benutzername und Passwort sind erforderlich.' })
  }

  try {
    const serverUrl = normalizeServerUrl(rawServerUrl)

    const loginRes = await callYuvomi(serverUrl, 'auth/login', {
      method: 'POST',
      body: { username, password },
    })

    if (loginRes.status !== 200) {
      const reason = loginRes.json?.reason
      const message = reason === 'account_cannot_sign_in'
        ? 'Dieses Konto kann sich nicht anmelden.'
        : reason === 'password_login_disabled'
          ? 'Passwort-Anmeldung ist auf diesem Server deaktiviert.'
          : 'Benutzername oder Passwort ist falsch.'
      throw createError({ statusCode: loginRes.status === 429 ? 429 : 401, statusMessage: message })
    }

    const sessionCookie = cookiePairsOnly(loginRes.setCookies)

    if (loginRes.json?.twoFactorRequired) {
      return {
        twoFactorRequired: true,
        recoveryAvailable: !!loginRes.json.recoveryAvailable,
        pendingCookie: sessionCookie,
        serverUrl,
      }
    }

    const result = await mintDeviceCredential(serverUrl, sessionCookie, loginRes.json.csrfToken)
    return { twoFactorRequired: false, serverUrl, ...result }
  } catch (err) {
    if (err instanceof YuvomiProxyError) {
      throw createError({ statusCode: err.status, statusMessage: err.message, data: err.body })
    }
    throw err
  }
})
