import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a chave service-role. Ignora RLS — usar SOMENTE no
 * servidor para operações privilegiadas (ex.: criar usuários/perfis). Nunca
 * importar em código que rode no navegador.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Schema dedicado apos a unificacao (ver client.ts). profiles e auth.users
      // sao acessados com `.schema("public")` / auth.admin onde necessario.
      db: { schema: "financeiro" },
      // O Next embrulha o fetch global e guarda resposta de GET. Como o
      // supabase-js le por GET, a consulta ao banco vinha do cache: uma venda
      // recem-enviada pelo corretor simplesmente nao aparecia na fila. Leitura
      // de banco nao e conteudo estatico.
      global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
    },
  );
}
