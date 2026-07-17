import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export interface SessionProfile {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Retorna o usuário autenticado e seu perfil, ou null se não houver sessão.
 * Memoizado por request com React cache(): o layout, o layout aninhado e a page
 * chamam requireProfile/requireRole no mesmo render — sem isso seriam N chamadas
 * sequenciais de getUser() + query de profile (cada uma um round-trip de rede).
 * cache() é escopado por request (não vaza entre usuários) e não altera a validação.
 */
export const getSessionProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .schema("public")
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) return null;
    return {
      userId: user.id,
      email: user.email ?? "",
      profile: profile as Profile,
    };
  },
);

/** Garante que há sessão; caso contrário redireciona para /login. */
export async function requireProfile(): Promise<SessionProfile> {
  const res = await getSessionProfile();
  if (!res) redirect("/login");
  return res;
}

/**
 * Garante que o usuário tem um dos papéis informados.
 * Corretor sem acesso é mandado para o próprio extrato; demais para o dashboard.
 */
export async function requireRole(roles: AppRole[]): Promise<SessionProfile> {
  const res = await requireProfile();
  if (!roles.includes(res.profile.role)) {
    redirect(res.profile.role === "corretor" ? "/meu-extrato" : "/dashboard");
  }
  return res;
}

/** Papéis considerados "staff" (acesso administrativo/financeiro/diretoria). */
export const STAFF_ROLES: AppRole[] = ["admin", "financeiro", "diretor"];
export const ADMIN_FIN_ROLES: AppRole[] = ["admin", "financeiro"];
