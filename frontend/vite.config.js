import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/predict': {
        target: 'http://51.20.142.229',
        changeOrigin: true,
      },
      '/copilot': {
        target: 'http://51.20.142.229',
        changeOrigin: true,
      },
    },
  },
})

