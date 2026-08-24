import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The main shell is about 1.1 MB minified (294 KB gzip) and the on-demand
    // PDF worker is about 1.3 MB. Keep this warning meaningful at that ceiling.
    chunkSizeWarningLimit: 1300,
  },
  server: {
    watch: {
      ignored: [
        "**/.DS_Store",
        "**/.git/**",
        "**/node_modules/**"
      ],
    },
  },
})
