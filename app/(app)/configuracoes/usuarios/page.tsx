import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import {
  UsuariosManager,
  type Usuario,
} from "@/components/configuracoes/usuarios-manager";

export default async function UsuariosPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const [profilesRes, corretoresRes, usersRes] = await Promise.all([
    supabase.schema("public").from("profiles").select("*"),
    supabase.from("corretores").select("id, nome").eq("ativo", true).order("nome"),
    admin.auth.admin.listUsers(),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const corretores = (corretoresRes.data ?? []) as { id: string; nome: string }[];
  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const usuarios: Usuario[] = profiles.map((p) => ({
    id: p.id,
    nome: p.nome,
    email: emailById.get(p.id) ?? "",
    role: p.role,
    corretor_id: p.corretor_id,
    ativo: p.ativo,
  }));

  return <UsuariosManager usuarios={usuarios} corretores={corretores} />;
}
