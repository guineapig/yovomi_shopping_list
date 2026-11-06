import type { Session, YuvomiUser } from '~/types/yuvomi'

interface LoginOk {
  twoFactorRequired: false
  serverUrl: string
  credential: string
  user: YuvomiUser | null
}

interface LoginTwoFactor {
  twoFactorRequired: true
  recoveryAvailable: boolean
  pendingCookie: string
  serverUrl: string
}

/** Drives the two-step sign-in handshake against our own /api/auth/* routes. */
export function useYuvomiAuth() {
  const { setSession } = useSession()
  const pending = ref<{ pendingCookie: string; serverUrl: string; recoveryAvailable: boolean } | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  async function login(serverUrl: string, username: string, password: string) {
    error.value = null
    loading.value = true
    try {
      const res = await $fetch<LoginOk | LoginTwoFactor>('/api/auth/login', {
        method: 'POST',
        body: { serverUrl, username, password },
      })
      if (res.twoFactorRequired) {
        pending.value = { pendingCookie: res.pendingCookie, serverUrl: res.serverUrl, recoveryAvailable: res.recoveryAvailable }
        return { twoFactorRequired: true as const }
      }
      setSession({ serverUrl: res.serverUrl, credential: res.credential, user: res.user } satisfies Session)
      return { twoFactorRequired: false as const }
    } catch (err: any) {
      error.value = err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Anmeldung fehlgeschlagen.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function verifyTwoFactor(code: string) {
    if (!pending.value) throw new Error('Kein ausstehender Anmeldevorgang.')
    error.value = null
    loading.value = true
    try {
      const res = await $fetch<{ serverUrl: string; credential: string; user: YuvomiUser | null }>('/api/auth/verify-2fa', {
        method: 'POST',
        body: { serverUrl: pending.value.serverUrl, pendingCookie: pending.value.pendingCookie, code },
      })
      setSession({ serverUrl: res.serverUrl, credential: res.credential, user: res.user } satisfies Session)
      pending.value = null
    } catch (err: any) {
      error.value = err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Bestätigung fehlgeschlagen.'
      throw err
    } finally {
      loading.value = false
    }
  }

  function cancelTwoFactor() {
    pending.value = null
    error.value = null
  }

  return { login, verifyTwoFactor, cancelTwoFactor, pending, error, loading }
}
