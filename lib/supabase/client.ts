import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no navegador (Client Components).
 *
 * Schema padrao `financeiro`: apos a unificacao, este app vive num schema
 * dedicado dentro do banco do painel. As tabelas financeiras sao consultadas
 * sem prefixo; a identidade (profiles) usa `.schema("public")` onde aparece.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "financeiro" } },
  );
}
