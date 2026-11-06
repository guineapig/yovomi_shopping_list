import { randomUUID } from 'node:crypto'
import { callYuvomi } from './yuvomi'

/**
 * Mints a long-lived device credential for an already-authenticated browser
 * session, then ends that temporary session: from here on the client talks
 * to Yuvomi purely with `Authorization: Bearer <credential>`, which needs no
 * cookies and no CSRF token (see server/auth.js in the Yuvomi repo).
 */
export async function mintDeviceCredential(serverUrl: string, sessionCookie: string, csrfToken?: string) {
  const deviceRes = await callYuvomi(serverUrl, 'auth/devices', {
    method: 'POST',
    headers: {
      cookie: sessionCookie,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: {
      name: 'Einkaufsliste PWA',
      platform: 'web',
      device_id: randomUUID(),
    },
  })

  if (deviceRes.status !== 201 || !deviceRes.json?.credential) {
    throw createError({ statusCode: 502, statusMessage: 'Geräte-Anmeldung bei Yuvomi ist fehlgeschlagen.' })
  }

  // Best-effort: the browser session is no longer needed once we hold a device credential.
  await callYuvomi(serverUrl, 'auth/logout', {
    method: 'POST',
    headers: { cookie: sessionCookie, ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
  }).catch(() => {})

  const credential = deviceRes.json.credential as string
  const meRes = await callYuvomi(serverUrl, 'auth/me', {
    headers: { authorization: `Bearer ${credential}` },
  })

  return {
    credential,
    user: meRes.status === 200 ? meRes.json?.user ?? null : null,
  }
}
