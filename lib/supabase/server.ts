import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso no servidor (Server Components, Server Actions,
 * Route Handlers). Lê/escreve os cookies da sessão, de modo que as políticas
 * RLS são aplicadas no contexto do usuário autenticado.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Schema dedicado apos a unificacao (ver client.ts). profiles usa
      // `.schema("public")` nos poucos pontos que o consultam.
      db: { schema: "financeiro" },
      // Mesmo motivo do cliente admin: o Next guarda resposta de GET e o
      // supabase-js le por GET. Aqui e pior, porque a leitura passa por RLS:
      // uma resposta guardada poderia ser servida a outro usuario.
      global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component — ignorar; o middleware renova a sessão.
          }
        },
      },
    },
  );
}
