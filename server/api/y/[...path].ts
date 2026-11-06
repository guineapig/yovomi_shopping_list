import { callYuvomi, normalizeServerUrl, YuvomiProxyError } from '../../utils/yuvomi'

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Generic data-plane proxy: forwards one call to `${x-yuvomi-base}/api/v1/<path>`
 * with the client's own `Authorization: Bearer <device credential>` header.
 * Stateless by design - nothing here is stored server-side.
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') ?? ''
  const rawBase = getRequestHeader(event, 'x-yuvomi-base')
  const authorization = getRequestHeader(event, 'authorization')

  if (!rawBase) {
    throw createError({ statusCode: 400, statusMessage: 'x-yuvomi-base header fehlt.' })
  }
  if (!authorization) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet.' })
  }

  const method = event.method
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(getQuery(event))) {
    if (v !== undefined) query[k] = Array.isArray(v) ? String(v[0]) : String(v)
  }

  let body: unknown
  if (BODY_METHODS.has(method)) {
    try {
      body = await readBody(event)
    } catch {
      body = undefined
    }
  }

  try {
    const base = normalizeServerUrl(rawBase)
    const result = await callYuvomi(base, path, {
      method,
      headers: { authorization },
      query,
      body,
    })
    setResponseStatus(event, result.status)
    return result.json
  } catch (err) {
    if (err instanceof YuvomiProxyError) {
      setResponseStatus(event, err.status)
      return err.body
    }
    throw err
  }
})
