import { Plus, Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { getConfig } from "@/lib/data/cadastros";
import { formatBRL, formatData } from "@/lib/format";
import { ENTRADA_TIPO_LABEL, type Entrada, type PercentualMensal } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EntradaFormDialog,
  type VendaDisponivel,
} from "@/components/entradas/entrada-form-dialog";
import { EntradaDelete } from "@/components/entradas/entrada-delete";

interface EntradaRow extends Entrada {
  distribuicoes: { destino: "empresa" | "pessoal"; valor: number }[];
}

interface VendaDispRow {
  id: string;
  cliente: string | null;
  liquido_zefer: number;
  empreendimentos: { nome: string } | null;
}

export default async function EntradasPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const supabase = await createClient();
  const [config, entradasRes, vendasRes, percentuaisRes] = await Promise.all([
    getConfig(),
    supabase
      .from("entradas")
      .select("*, distribuicoes(destino, valor)")
      .order("data", { ascending: false }),
    supabase
      .from("vendas")
      .select("id, cliente, liquido_zefer, empreendimentos(nome)")
      .eq("status", "aguardando_recebimento")
      .order("data_venda", { ascending: false }),
    supabase.from("percentuais_mensais").select("*"),
  ]);

  const entradas = (entradasRes.data ?? []) as unknown as EntradaRow[];
  const vendasDisp = (vendasRes.data ?? []) as unknown as VendaDispRow[];
  const percentuaisMensais = (percentuaisRes.data ?? []) as unknown as PercentualMensal[];

  const vendas: VendaDisponivel[] = vendasDisp.map((v) => ({
    id: v.id,
    valor: Number(v.liquido_zefer),
    label: `${v.empreendimentos?.nome ?? "Venda"}${v.cliente ? " — " + v.cliente : ""} (${formatBRL(v.liquido_zefer)})`,
  }));

  const valorDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    e.distribuicoes?.find((d) => d.destino === destino)?.valor ?? 0;

  const totalValor = entradas.reduce((s, e) => s + Number(e.valor), 0);
  const totalLiquido = entradas.reduce((s, e) => s + Number(e.liquido), 0);
  const totalEmpresa = entradas.reduce((s, e) => s + Number(valorDe(e, "empresa")), 0);
  const totalPessoal = entradas.reduce((s, e) => s + Number(valorDe(e, "pessoal")), 0);

  return (
    <div>
      <PageHeader
        title="Entradas e Distribuições"
        description="Toda entrada financeira, com dízimo e distribuição empresa/pessoal."
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
          {entradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma entrada registrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Dízimo</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="text-right">Empresa</TableHead>
                  <TableHead className="text-right">Pessoal</TableHead>
                  {podeEditar ? <TableHead></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entradas.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(e.data)}
                    </TableCell>
                    <TableCell>{ENTRADA_TIPO_LABEL[e.tipo]}</TableCell>
                    <TableCell>{e.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(e.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatBRL(e.valor_dizimo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(e.liquido)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(valorDe(e, "empresa"))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(valorDe(e, "pessoal"))}
                    </TableCell>
                    {podeEditar ? (
                      <TableCell>
                        <div className="flex justify-end">
                          <EntradaFormDialog
                            config={config}
                            vendas={vendas}
                            entrada={e}
                            percentuaisMensais={percentuaisMensais}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Editar">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <EntradaDelete id={e.id} />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalValor)}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalLiquido)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalEmpresa)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalPessoal)}
                  </TableCell>
                  {podeEditar ? <TableCell></TableCell> : null}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
