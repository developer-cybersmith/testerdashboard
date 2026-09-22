import { withSupabase } from 'npm:@supabase/server'

export default {
  fetch: withSupabase({ auth: 'none' }, async (_req, ctx) => {
    const { error } = await ctx.supabaseAdmin.from('people').select('id').limit(1)
    return Response.json({
      ok: !error,
      service: 'cybersmith-health',
      time: new Date().toISOString(),
      database: error ? error.message : 'up',
    })
  }),
}
