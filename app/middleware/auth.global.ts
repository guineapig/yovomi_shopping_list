export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const { session, restored, restore } = useSession()
  if (!restored.value) restore()

  if (!session.value && to.path !== '/login') {
    return navigateTo('/login')
  }
  if (session.value && to.path === '/login') {
    return navigateTo('/')
  }
})
