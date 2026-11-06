export default defineNuxtPlugin(() => {
  const { restore } = useSession()
  restore()
})
