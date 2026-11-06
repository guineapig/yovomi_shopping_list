/**
 * Thin, stateless reverse proxy helpers for talking to a self-hosted Yuvomi
 * instance. Nitro runs server-side, so these fetches are server-to-server and
 * sidestep the browser CORS restriction that a self-hosted Yuvomi server does
 * not lift on its own. Nothing here is persisted: credentials and the target
 * server URL live only in the browser and pass through on every request.
 */

export class YuvomiProxyError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Yuvomi request failed with status ${status}`)
    this.status = status
    this.body = body
  }
}

/** Normalizes and validates a user-supplied server URL (http/https only, no trailing slash). */
export function normalizeServerUrl(raw: string): string {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new YuvomiProxyError(400, { error: 'invalid_server_url' }, 'Server-URL ist ungültig.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new YuvomiProxyError(400, { error: 'invalid_server_url' }, 'Server-URL muss http oder https sein.')
  }
  return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/+$/, '')
}

function allSetCookies(res: Response): string[] {
  const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie
  if (typeof getSetCookie === 'function') return getSetCookie.call(res.headers)
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

/** Strips attributes a server-to-server replay cannot honor and keeps only name=value. */
export function cookiePairsOnly(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

export interface YuvomiCallOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  query?: Record<string, string | undefined>
}

export interface YuvomiCallResult {
  status: number
  json: any
  setCookies: string[]
}

/** Calls one Yuvomi API path and returns the parsed JSON body plus any Set-Cookie headers. */
export async function callYuvomi(base: string, path: string, opts: YuvomiCallOptions = {}): Promise<YuvomiCallResult> {
  const url = new URL(`${base}/api/v1/${path.replace(/^\/+/, '')}`)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, v)
    }
  }

  const headers: Record<string, string> = { accept: 'application/json', ...opts.headers }
  let body: string | undefined
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  let res: Response
  try {
    res = await fetch(url, { method: opts.method ?? 'GET', headers, body, redirect: 'manual' })
  } catch (err: any) {
    throw new YuvomiProxyError(502, { error: 'yuvomi_unreachable' }, `Yuvomi-Server nicht erreichbar: ${err?.message ?? err}`)
  }

  const setCookies = allSetCookies(res)
  const text = await res.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  return { status: res.status, json, setCookies }
}
