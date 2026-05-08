import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_ANON_KEY ?? ''
  return createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key')
}

let _client: any = null

// Tipado como `any` de propósito: o cliente é um Proxy preguiçoso que pode
// apontar para um placeholder durante o build sem variáveis de ambiente.
// Os genéricos estritos do `@supabase/supabase-js` quebram a indireção via
// `ReturnType<typeof createClient>` em TS recente.
export const supabase: any = new Proxy({}, {
  get(_target, prop) {
    if (!_client) _client = getSupabaseClient()
    return _client[prop]
  },
})

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-key',
  )
}
