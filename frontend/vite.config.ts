import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * GitHub Pages has no SPA rewrite. Serving the same document as 404.html means
 * a deep link like /deals/12 still boots the app instead of dead-ending.
 */
function spaFallback(outDir: string) {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDemo = env.VITE_DEMO === 'true'
  const outDir = resolve(process.cwd(), 'dist')

  return {
    base: env.VITE_BASE || '/',
    plugins: [react(), tailwindcss(), ...(isDemo ? [spaFallback(outDir)] : [])],
    resolve: {
      // Keep the demo backend and its fixture out of the real build entirely.
      alias: isDemo
        ? []
        : [{ find: /^\.\.\/demo\/store$/, replacement: resolve(__dirname, 'src/demo/stub.ts') }],
    },
    server: {
      port: 5173,
      // Talk to the API on the same origin in dev so headers stay simple.
      proxy: {
        '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
  }
})
