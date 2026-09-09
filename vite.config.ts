import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const csp = (dev: boolean) =>
  [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `script-src 'self'${dev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

const securityHeaders = (dev: boolean) => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': csp(dev),
})

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: securityHeaders(true) },
  preview: { headers: securityHeaders(false) },
})

