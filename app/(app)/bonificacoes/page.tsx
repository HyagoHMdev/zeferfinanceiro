import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listarBonificacoes } from "@/lib/data/bonificacoes";
import { formatBRL, formatData } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { BonificacoesView } from "@/components/bonificacoes/bonificacoes-view";
import type {
  CorretorOpcao,
  VendaOpcao,
} from "@/components/bonificacoes/bonificacao-form-dialog";

export const dynamic = "force-dynamic";

export default async function BonificacoesPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeDecidir = ADMIN_FIN_ROLES.includes(profile.role);
  const supabase = await createClient();

  // Corretores e vendas alimentam o lançamento manual. Só para quem decide:
  // corretor abre esta tela para acompanhar o que é dele, não para lançar.
  const [bonificacoes, corretoresRes, vendasRes] = await Promise.all([
    listarBonificacoes(),
    podeDecidir
      ? supabase.from("corretores").select("id, nome").eq("ativo", true).order("nome")
      : Promise.resolve({ data: [] }),
    podeDecidir
      ? supabase
          .from("vendas")
          .select("id, cliente, data_venda, vgv, corretor_id, empreendimentos(nome)")
          .order("data_venda", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const corretores = ((corretoresRes.data ?? []) as { id: string; nome: string }[]).map(
    (c): CorretorOpcao => ({ id: c.id, nome: c.nome }),
  );

  const vendas = (
    (vendasRes.data ?? []) as unknown as {
      id: string;
      cliente: string | null;
      data_venda: string;
      vgv: number;
      corretor_id: string | null;
      empreendimentos: { nome: string } | null;
    }[]
  ).map(
    (v): VendaOpcao => ({
      id: v.id,
      corretorId: v.corretor_id,
      data: v.data_venda,
      // A data entra no rótulo porque é ela que a bonificação vai herdar:
      // quem escolhe precisa ver qual data está puxando.
      label: `${v.empreendimentos?.nome ?? "Venda"}${v.cliente ? " · " + v.cliente : ""} (${formatData(v.data_venda)} · ${formatBRL(v.vgv)})`,
    }),
  );

  return (
    <div>
      <PageHeader
        title="Bonificações"
        description="Bônus de campanha da construtora. Confira contra o print, aprove e pague quando a construtora liberar."
      />
      <BonificacoesView
        bonificacoes={bonificacoes}
        podeDecidir={podeDecidir}
        corretores={corretores}
        vendas={vendas}
      />
    </div>
  );
}
