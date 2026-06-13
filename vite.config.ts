/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // core es TS puro (sin DOM): el entorno node basta para v0.1.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
