import { callYuvomi, normalizeServerUrl, YuvomiProxyError } from '../../utils/yuvomi'
import { mintDeviceCredential } from '../../utils/device'

/** Step 2 of signing in when the account has two-factor authentication enabled. */
export default defineEventHandler(async (event) => {
  const { serverUrl: rawServerUrl, code, pendingCookie } = await readBody<{
    serverUrl: string
    code: string
    pendingCookie: string
  }>(event)

  if (!code || !pendingCookie) {
    throw createError({ statusCode: 400, statusMessage: 'Code fehlt.' })
  }

  try {
    const serverUrl = normalizeServerUrl(rawServerUrl)

    const verifyRes = await callYuvomi(serverUrl, 'auth/2fa/verify', {
      method: 'POST',
      headers: { cookie: pendingCookie },
      body: { code },
    })

    if (verifyRes.status !== 200) {
      const message = verifyRes.status === 401
        ? 'Code ist falsch oder abgelaufen.'
        : 'Zwei-Faktor-Bestätigung ist fehlgeschlagen.'
      throw createError({ statusCode: verifyRes.status === 429 ? 429 : 401, statusMessage: message })
    }

    const result = await mintDeviceCredential(serverUrl, pendingCookie, verifyRes.json?.csrfToken)
    return { serverUrl, ...result }
  } catch (err) {
    if (err instanceof YuvomiProxyError) {
      throw createError({ statusCode: err.status, statusMessage: err.message, data: err.body })
    }
    throw err
  }
})
