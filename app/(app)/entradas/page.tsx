import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { getConfig } from "@/lib/data/cadastros";
import { formatBRL } from "@/lib/format";
import type { PercentualMensal } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EntradaFormDialog,
  type VendaDisponivel,
} from "@/components/entradas/entrada-form-dialog";
import {
  EntradasTable,
  type EntradaRow,
} from "@/components/entradas/entradas-table";

interface VendaDispRow {
  id: string;
  cliente: string | null;
  lucro_liquido: number;
  empreendimentos: { nome: string } | null;
}

export default async function EntradasPage() {
  const supabase = await createClient();
  const [{ profile }, config, entradasRes, vendasRes, percentuaisRes] =
    await Promise.all([
      requireRole(STAFF_ROLES),
      getConfig(),
      supabase
        .from("entradas")
        .select(
          "*, distribuicoes(destino, valor, percentual), vendas(comissao_bruta, liquido_zefer, lucro_liquido)",
        )
        .order("data", { ascending: false }),
      supabase
        .from("vendas")
        .select("id, cliente, lucro_liquido, empreendimentos(nome)")
        .eq("status", "aguardando_recebimento")
        .order("data_venda", { ascending: false }),
      supabase.from("percentuais_mensais").select("*"),
    ]);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const entradas = (entradasRes.data ?? []) as unknown as EntradaRow[];
  const vendasDisp = (vendasRes.data ?? []) as unknown as VendaDispRow[];
  const percentuaisMensais = (percentuaisRes.data ?? []) as unknown as PercentualMensal[];

  const vendas: VendaDisponivel[] = vendasDisp.map((v) => ({
    id: v.id,
    valor: Number(v.lucro_liquido),
    label: `${v.empreendimentos?.nome ?? "Venda"}${v.cliente ? " — " + v.cliente : ""} (${formatBRL(v.lucro_liquido)})`,
  }));

  return (
    <div>
      <PageHeader
        title="Entradas e Distribuições"
        description="Toda entrada financeira, com dízimo e distribuição empresa/pessoal."
        help={<OnboardingHelp screen="entradas" />}
      >
        {podeEditar ? (
          <EntradaFormDialog
            config={config}
            vendas={vendas}
            percentuaisMensais={percentuaisMensais}
            trigger={
              <Button>
                <Plus className="size-4" />
                Nova entrada
              </Button>
            }
          />
        ) : null}
      </PageHeader>

      <Card>
        <CardContent className="px-0">
          <EntradasTable
            entradas={entradas}
            podeEditar={podeEditar}
            config={config}
            vendas={vendas}
            percentuaisMensais={percentuaisMensais}
          />
        </CardContent>
      </Card>
    </div>
  );
}
