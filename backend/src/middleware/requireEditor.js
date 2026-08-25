const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

/**
 * Exige un usuario con rol editor o admin.
 *
 * El resto del backend usa la service_role key y se saltea RLS, así que las
 * rutas que gastan cuota de una API externa necesitan su propio control: sin
 * esto cualquiera podría vaciar el cupo diario de YouTube con un curl.
 */
async function requireEditor(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Falta el token de sesión' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Sesión inválida' })

    const { data: profile } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!profile || !['editor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Se requiere rol de editor' })
    }

    req.user = profile
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = { requireEditor }
