import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O navegador fala só com /api; o Vite repassa para o servidor Node (que é quem acessa o Neon).
export default defineConfig({
  plugins: [react()],
  server: {
    // changeOrigin fica desligado de propósito: a API compara Origin com Host (proteção CSRF).
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
})
