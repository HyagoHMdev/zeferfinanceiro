import { Suspense } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { formatBRL, formatData } from "@/lib/format";
import type { VendaStatus } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FiltroCorretor } from "@/components/vendas/filtro-corretor";
import { VendaStatusBadge } from "@/components/vendas/status-badge";
import { VendaStatusSelect } from "@/components/vendas/venda-status-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VendaRow {
  id: string;
  data_venda: string;
  unidade: string | null;
  cliente: string | null;
  origem: string | null;
  vgv: number;
  comissao_bruta: number;
  liquido_zefer: number;
  liquido_corretor: number;
  lucro_liquido: number;
  status: VendaStatus;
  construtoras: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  corretores: { nome: string } | null;
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ corretor?: string }>;
}) {
  const supabase = await createClient();
  const { corretor: corretorFiltro } = await searchParams;

  let q = supabase
    .from("vendas")
    .select(
      "id, data_venda, unidade, cliente, origem, vgv, comissao_bruta, liquido_zefer, liquido_corretor, lucro_liquido, status, construtoras(nome), empreendimentos(nome), corretores(nome)",
    );
  // O filtro entra na CONSULTA, não na tela: assim os totais do rodapé já saem
  // do recorte, sem ter que recalcular em dois lugares.
  if (corretorFiltro) q = q.eq("corretor_id", corretorFiltro);

  const [{ profile }, { data }, corretoresRes] = await Promise.all([
    requireRole(STAFF_ROLES),
    q.order("data_venda", { ascending: false }),
    supabase
      .from("corretores")
      .select("id, nome")
      .eq("tipo", "corretor")
      .order("nome"),
  ]);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);
  const corretores = (corretoresRes.data ?? []) as { id: string; nome: string }[];

  const vendas = (data ?? []) as unknown as VendaRow[];
  const totalVgv = vendas.reduce((s, v) => s + Number(v.vgv), 0);
  const totalComissaoBruta = vendas.reduce((s, v) => s + Number(v.comissao_bruta), 0);
  const totalLiquidoZefer = vendas.reduce((s, v) => s + Number(v.liquido_zefer), 0);
  const totalLucro = vendas.reduce((s, v) => s + Number(v.lucro_liquido), 0);

  return (
    <div>
      <PageHeader title="Vendas" description="Comissões de cada venda registrada." help={<OnboardingHelp screen="vendas" />}>
        {podeEditar ? (
          <Button asChild>
            <Link href="/vendas/nova">
              <Plus className="size-4" />
              Nova venda
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <Suspense fallback={null}>
            <FiltroCorretor corretores={corretores} valor={corretorFiltro ?? null} />
          </Suspense>
        </CardHeader>
        <CardContent className="px-0">
          {vendas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {corretorFiltro
                ? "Nenhuma venda deste corretor."
                : "Nenhuma venda cadastrada ainda."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">VGV</TableHead>
                  <TableHead className="text-right">Comissão bruta</TableHead>
                  <TableHead className="text-right">Líquido Zefer</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead>Status</TableHead>
                  {podeEditar ? <TableHead></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(v.data_venda)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{v.cliente ?? "—"}</div>
                      {v.origem ? (
                        <div className="text-xs text-muted-foreground">{v.origem}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {v.empreendimentos?.nome ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[v.construtoras?.nome, v.unidade]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{v.corretores?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(v.vgv)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(v.comissao_bruta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(v.liquido_zefer)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(v.lucro_liquido)}
                    </TableCell>
                    <TableCell>
                      {podeEditar ? (
                        <VendaStatusSelect id={v.id} status={v.status} />
                      ) : (
                        <VendaStatusBadge status={v.status} />
                      )}
                    </TableCell>
                    {podeEditar ? (
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/vendas/${v.id}`} aria-label="Editar">
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                {/* As células seguem a MESMA ordem do cabeçalho: Data, Cliente,
                    Empreendimento, Corretor | VGV, Comissão bruta, Líquido
                    Zefer, Lucro | Status (+ editar). Coluna nova aqui em cima
                    exige acertar este rodapé, senão os totais escorregam. */}
                <TableRow>
                  <TableCell colSpan={4}>Total ({vendas.length})</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalVgv)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalComissaoBruta)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalLiquidoZefer)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(totalLucro)}
                  </TableCell>
                  <TableCell colSpan={podeEditar ? 2 : 1}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
