import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AniversariosView, type AniversarioRow } from "./aniversarios-view";

export const dynamic = "force-dynamic";

export default async function AniversariosPage() {
  const { profile } = await requireRole(STAFF_ROLES);

  const supabase = await createClient();
  const { data } = await supabase
    .schema("public")
    .from("aniversariantes")
    .select("id,nome,dia,mes,telefone")
    .order("nome");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aniversários"
        description="Aniversários dos clientes. Um aviso aparece no topo no dia do aniversário."
      />
      <AniversariosView
        aniversariantes={(data ?? []) as AniversarioRow[]}
        podeEditar={ADMIN_FIN_ROLES.includes(profile.role)}
      />
    </div>
  );
}
