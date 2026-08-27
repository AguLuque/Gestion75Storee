import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // aplica actualizaciones solo, sin dejar a nadie en una versión vieja
      includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png'],
      manifest: {
        id: '/',
        name: 'FluxoGest',
        short_name: 'FluxoGest',
        description: 'Gestión de ventas, compras, gastos y stock para tu negocio.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F8FAFC',
        theme_color: '#186878',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo cachea los archivos estáticos del build (JS/CSS/HTML/íconos).
        // Nunca se agrega una regla de runtimeCaching para /api — así los pedidos
        // al backend siempre van a la red, nunca se sirve stock/precios desde caché vieja.
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    host: true, // escucha en todas las interfaces de red (accesible desde el celular)
  },
})
