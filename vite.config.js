import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Tailwind CSS v4 is wired in through this Vite plugin.
    // There is deliberately NO tailwind.config.js, no postcss.config.js and no
    // `content` array — that is the v3 setup and does not apply to v4.
    // Design tokens live in src/index.css under the @theme directive.
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
})
