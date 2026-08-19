"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

import {
  STATUS_BONIFICACAO_LABEL,
  type BonificacaoLinha,
  type BonificacaoStatus,
} from "@/lib/types";
import {
  abrirAnexoBonificacao,
  aprovarBonificacao,
  pagarBonificacao,
  recusarBonificacao,
} from "@/app/(app)/bonificacoes/actions";
import { formatBRL, formatData } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/kpi-card";

const VARIANTE: Record<BonificacaoStatus, "warning" | "success" | "default" | "destructive"> = {
  pendente: "warning",
  aprovada: "default",
  paga: "success",
  recusada: "destructive",
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function BonificacoesView({
  bonificacoes,
  podeDecidir,
}: {
  bonificacoes: BonificacaoLinha[];
  podeDecidir: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [dataPg, setDataPg] = useState<Record<string, string>>({});

  // "Aprovada" é o número que mais interessa: já foi conferida contra o print e
  // ainda não entrou, ou seja, é o que a construtora ainda deve.
  const totais = useMemo(() => {
    const soma = (s: BonificacaoStatus) =>
      bonificacoes.filter((b) => b.status === s).reduce((t, b) => t + b.valor, 0);
    return { pendente: soma("pendente"), aprovada: soma("aprovada"), paga: soma("paga") };
  }, [bonificacoes]);

  async function executar(id: string, fn: () => Promise<{ error?: string }>) {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (r?.error) return toast.error(r.error);
    router.refresh();
  }

  async function abrir(path: string) {
    const r = await abrirAnexoBonificacao(path);
    if (r.erro) return toast.error(r.erro);
    if (r.url) window.open(r.url, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="A conferir" value={totais.pendente} />
        <KpiCard label="Aprovadas, aguardando a construtora" value={totais.aprovada} />
        <KpiCard label="Pagas" value={totais.paga} tone="positive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bonificações</CardTitle>
        </CardHeader>
        <CardContent>
          {bonificacoes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma bonificação ainda. Elas chegam sozinhas quando o corretor marca a
              bonificação na venda e o financeiro aprova essa venda.
            </p>
          ) : (
            <ul className="divide-y">
              {bonificacoes.map((b) => (
                <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{b.campanha ?? "Campanha"}</span>
                      <Badge variant={VARIANTE[b.status]}>
                        {STATUS_BONIFICACAO_LABEL[b.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {b.corretorNome ?? "Corretor"}
                      {b.empreendimento ? ` · ${b.empreendimento}` : ""}
                      {b.cliente ? ` · ${b.cliente}` : ""}
                      {` · venda de ${formatData(b.data)}`}
                      {b.pagoEm ? ` · pago em ${formatData(b.pagoEm)}` : ""}
                    </p>
                    {b.observacao ? (
                      <p className="mt-1 text-sm text-muted-foreground">{b.observacao}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {b.anexos.map((a) => (
                        <button
                          key={a.path}
                          type="button"
                          onClick={() => abrir(a.path)}
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          {a.nome}
                        </button>
                      ))}
                      {b.anexos.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Sem print da campanha.
                        </span>
                      ) : null}
                      {b.vendaId ? (
                        <Link
                          href={`/vendas/${b.vendaId}`}
                          className="text-xs text-muted-foreground underline underline-offset-2"
                        >
                          ver a venda
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="font-semibold tabular-nums">{formatBRL(b.valor)}</span>

                    {podeDecidir && b.status !== "paga" ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {b.status !== "aprovada" ? (
                          <>
                            <Input
                              placeholder="motivo (para recusar)"
                              value={motivo[b.id] ?? ""}
                              onChange={(e) =>
                                setMotivo((m) => ({ ...m, [b.id]: e.target.value }))
                              }
                              className="h-8 w-48"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === b.id}
                              onClick={() =>
                                executar(b.id, () =>
                                  recusarBonificacao({ id: b.id, observacao: motivo[b.id] }),
                                )
                              }
                            >
                              Recusar
                            </Button>
                            <Button
                              size="sm"
                              disabled={busy === b.id}
                              onClick={() =>
                                executar(b.id, () =>
                                  aprovarBonificacao({ id: b.id, observacao: motivo[b.id] }),
                                )
                              }
                            >
                              Aprovar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Input
                              type="date"
                              value={dataPg[b.id] ?? hojeISO()}
                              onChange={(e) =>
                                setDataPg((d) => ({ ...d, [b.id]: e.target.value }))
                              }
                              className="h-8 w-40"
                            />
                            <Button
                              size="sm"
                              disabled={busy === b.id}
                              onClick={() =>
                                executar(b.id, () =>
                                  pagarBonificacao({
                                    id: b.id,
                                    data: dataPg[b.id] ?? hojeISO(),
                                  }),
                                )
                              }
                            >
                              Marcar como paga
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
