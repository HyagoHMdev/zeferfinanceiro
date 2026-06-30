import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { round2 } from "@/lib/calculos";
import { formatBRL } from "@/lib/format";
import type { Corretor, VendaStatus } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CorretoresPage() {
  await requireRole(STAFF_ROLES);
  const supabase = await createClient();

  const [corretoresRes, vendasRes, adiRes, bonRes] = await Promise.all([
    supabase.from("corretores").select("*").eq("ativo", true).order("nome"),
    supabase
      .from("vendas")
      .select("corretor_id, liquido_corretor, status, pagamento_id")
      .in("status", ["recebido", "pago"]),
    supabase.from("adiantamentos").select("corretor_id, valor").is("pagamento_id", null),
    supabase.from("bonificacoes").select("corretor_id, valor").is("pagamento_id", null),
  ]);

  const corretores = (corretoresRes.data ?? []) as Corretor[];
  const vendas = (vendasRes.data ?? []) as {
    corretor_id: string | null;
    liquido_corretor: number;
    status: VendaStatus;
    pagamento_id: string | null;
  }[];
  const adiantamentos = (adiRes.data ?? []) as { corretor_id: string; valor: number }[];
  const bonificacoes = (bonRes.data ?? []) as { corretor_id: string; valor: number }[];

  const somaPorCorretor = (
    rows: { corretor_id: string | null; valor: number }[],
  ) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.corretor_id) continue;
      m.set(r.corretor_id, (m.get(r.corretor_id) ?? 0) + Number(r.valor));
    }
    return m;
  };

  const pendentesMap = somaPorCorretor(
    vendas
      .filter((v) => v.status === "recebido" && v.pagamento_id == null)
      .map((v) => ({ corretor_id: v.corretor_id, valor: v.liquido_corretor })),
  );
  const adiMap = somaPorCorretor(adiantamentos);
  const bonMap = somaPorCorretor(bonificacoes);

  return (
    <div>
      <PageHeader
        title="Corretores"
        description="Saldo e pendências de cada corretor."
      />

      <Card>
        <CardContent className="px-0">
          {corretores.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum corretor cadastrado. Adicione em Configurações.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">Comissões pendentes</TableHead>
                  <TableHead className="text-right">Adiantamentos</TableHead>
                  <TableHead className="text-right">Bonificações</TableHead>
                  <TableHead className="text-right">Saldo disponível</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corretores.map((c) => {
                  const pend = round2(pendentesMap.get(c.id) ?? 0);
                  const adi = round2(adiMap.get(c.id) ?? 0);
                  const bon = round2(bonMap.get(c.id) ?? 0);
                  const saldo = round2(pend + bon - adi);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(pend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(adi)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(bon)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(saldo)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/corretores/${c.id}`}
                          className="inline-flex items-center text-sm text-primary hover:underline"
                        >
                          Extrato
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
