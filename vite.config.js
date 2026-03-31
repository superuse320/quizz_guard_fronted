import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'quizzia-fronted-xpmp8a-522d25-107-148-105-38.traefik.me',
      'quizziia.jojlab.com'
    ],
    watch: {
      usePolling: true,
    },
  },
})