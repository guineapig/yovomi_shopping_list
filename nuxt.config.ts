// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@vite-pwa/nuxt'],

  app: {
    head: {
      title: 'Einkaufsliste',
      meta: [
        { name: 'theme-color', content: '#16a34a' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Einkaufsliste für Yuvomi',
      short_name: 'Einkaufsliste',
      description: 'Eigenständige Einkaufslisten-App, die sich mit der API deiner selbst gehosteten Yuvomi-Instanz verbindet.',
      theme_color: '#16a34a',
      background_color: '#f8faf7',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'de',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      // API responses are handled by our own IndexedDB cache/outbox, not the SW.
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [
        {
          urlPattern: /\/api\/y\/.*/,
          handler: 'NetworkOnly',
        },
      ],
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },
})
