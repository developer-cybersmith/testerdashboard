import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const csp = (dev: boolean) =>
  [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `script-src 'self'${dev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
    "connect-src 'self' ws: wss: https://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

const securityHeaders = (dev: boolean) => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
  'Content-Security-Policy': csp(dev),
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || ''
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publishable),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '/api'),
    },
    plugins: [react(), tailwindcss()],
    server: {
      headers: securityHeaders(true),
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
    preview: {
      headers: securityHeaders(false),
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  }
})

