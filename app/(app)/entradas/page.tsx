import { Plus, Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { getConfig } from "@/lib/data/cadastros";
import { formatBRL, formatData } from "@/lib/format";
import {
  ENTRADA_TIPO_LABEL,
  type Entrada,
  type EntradaTipo,
  type PercentualMensal,
} from "@/lib/types";
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
import { EntradaTipoFiltro } from "@/components/entradas/tipo-filtro";

interface EntradaRow extends Entrada {
  distribuicoes: {
    destino: "empresa" | "pessoal";
    valor: number;
    percentual: number;
  }[];
}

interface VendaDispRow {
  id: string;
  cliente: string | null;
  liquido_zefer: number;
  empreendimentos: { nome: string } | null;
}

const TIPOS_VALIDOS: EntradaTipo[] = [
  "comissao",
  "bonificacao",
  "premiacao",
  "investidor",
  "outras",
];

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const { tipo } = await searchParams;
  const tipoFiltro = TIPOS_VALIDOS.includes(tipo as EntradaTipo)
    ? (tipo as EntradaTipo)
    : null;

  const supabase = await createClient();
  let entradasQuery = supabase
    .from("entradas")
    .select("*, distribuicoes(destino, valor, percentual)")
    .order("data", { ascending: false });
  if (tipoFiltro) entradasQuery = entradasQuery.eq("tipo", tipoFiltro);

  const [config, entradasRes, vendasRes, percentuaisRes] = await Promise.all([
    getConfig(),
    entradasQuery,
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

  const distDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    e.distribuicoes?.find((d) => d.destino === destino);
  const valorDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    Number(distDe(e, destino)?.valor ?? 0);
  const percDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    Number(distDe(e, destino)?.percentual ?? 0);

  const totalValor = entradas.reduce((s, e) => s + Number(e.valor), 0);
  const totalLiquido = entradas.reduce((s, e) => s + Number(e.liquido), 0);
  const totalEmpresa = entradas.reduce((s, e) => s + valorDe(e, "empresa"), 0);
  const totalPessoal = entradas.reduce((s, e) => s + valorDe(e, "pessoal"), 0);

  return (
    <div>
      <PageHeader
        title="Entradas e Distribuições"
        description="Toda entrada financeira, com dízimo e distribuição empresa/pessoal."
      >
        <EntradaTipoFiltro atual={tipoFiltro ?? "todos"} />
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
              Nenhuma entrada registrada.
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
                            percentualEmpresaInicial={percDe(e, "empresa")}
                            percentualPessoalInicial={percDe(e, "pessoal")}
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
