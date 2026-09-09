import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/// <reference types="vite/client" />

declare module "*?raw" {
  const content: string;
  export default content;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
