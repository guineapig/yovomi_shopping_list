import type { Session } from '~/types/yuvomi'

const STORAGE_KEY = 'yuvomi-shopping:session'

function readStoredSession(): Session | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

/**
 * The signed-in state: a server URL plus a device credential, held only in
 * this browser. `restored` tells the UI once the one-time localStorage read
 * has happened, so a guard doesn't bounce a signed-in user to /login during
 * the first render.
 */
export function useSession() {
  const session = useState<Session | null>('session', () => null)
  const restored = useState<boolean>('session:restored', () => false)

  function restore() {
    if (restored.value) return
    session.value = readStoredSession()
    restored.value = true
  }

  function setSession(next: Session) {
    session.value = next
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }

  function clearSession() {
    session.value = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return { session, restored, restore, setSession, clearSession }
}
