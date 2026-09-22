import './env.ts'
import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app.ts'
import { ensureStaffAccounts } from './ensureStaff.ts'

const port = Number(process.env.PORT || process.env.API_PORT || 8787)

if (existsSync('dist/index.html')) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

ensureStaffAccounts()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
  })
  .finally(() => {
    serve({ fetch: app.fetch, hostname: '0.0.0.0', port }, (info) => {
      console.log(`API listening on http://0.0.0.0:${info.port}`)
    })
  })
