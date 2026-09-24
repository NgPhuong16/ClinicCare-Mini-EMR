/**
 * Runs on every navigation, server and client. `doctor` is a useState, so on a hard load
 * this resolves once on the server (with the forwarded cookie) and the client picks up
 * the result from the payload — it must never call /auth/me a second time on hydration.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { doctor, isLoggedIn, fetchMe } = useAuth()

  if (doctor.value === undefined) {
    await fetchMe()
  }

  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (isLoggedIn.value && to.path === '/login') {
    return navigateTo('/consultations')
  }
})
