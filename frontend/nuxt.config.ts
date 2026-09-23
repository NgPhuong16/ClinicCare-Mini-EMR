// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint'],
  runtimeConfig: {
    public: {
      // The one place the backend URL is written. Override with NUXT_PUBLIC_API_BASE.
      apiBase: 'http://localhost:8000/api/v1'
    }
  }
})
