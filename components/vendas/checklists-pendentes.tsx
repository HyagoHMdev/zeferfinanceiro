"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

import { formatarCpf, formatBRL, formatData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { recusarChecklist, abrirAnexoChecklist } from "@/app/(app)/vendas/actions";
import type { ChecklistPendente } from "@/lib/data/checklist";

/**
 * Vendas submetidas pelos corretores, esperando aprovação.
 *
 * Fica no topo da tela de vendas porque é fila de trabalho: some sozinha
 * quando zera, em vez de virar um card vazio permanente.
 */
export function ChecklistsPendentes({ itens }: { itens: ChecklistPendente[] }) {
  const router = useRouter();
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();

  if (itens.length === 0) return null;

  async function ver(path: string) {
    const r = await abrirAnexoChecklist(path);
    if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
    else toast.error("Não foi possível abrir", { description: r.erro });
  }

  return (
    <Card className="mb-6 border-amber-500/40">
      <CardHeader>
        <CardTitle className="text-base">
          Aguardando aprovação{" "}
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            {itens.length}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Vendas enviadas pelos corretores. Aprovar abre o cadastro já
          preenchido, para você conferir os percentuais antes de gravar.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {itens.map((c) => (
          <div key={c.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {c.empreendimento}
                  {c.unidade ? ` · unidade ${c.unidade}` : ""}
                  {c.torre ? ` · torre ${c.torre}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.clienteNome}{c.clienteCpf ? ` · CPF ${formatarCpf(c.clienteCpf)}` : ""} ·{" "}
                  {formatBRL(c.valorContrato)} · {c.construtora}
                </p>
                <p className="text-xs text-muted-foreground">
                  Enviado por {c.corretorNome ?? "corretor"} em {formatData(c.criadoEm)}
                  {c.clienteCidade ? ` · ${c.clienteCidade}/${c.clienteEstado ?? ""}` : ""}
                  {c.finalidade ? ` · ${c.finalidade}` : ""}
                  {c.origem ? ` · origem: ${c.origem}` : ""}
                </p>
                {/* Atribuição pelo CRM, cruzada pelo telefone. Aparece aqui e
                    não só depois de aprovar, que é quando a venda passa a
                    existir: de onde o cliente veio pesa na hora de decidir. */}
                {c.lead && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Veio de{" "}
                    {c.lead.campanhaNome ?? c.lead.fonte ?? "origem não informada"} ·
                    primeiro contato em {formatData(c.lead.primeiroContato)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {/* Sem contrato e comprovante o aceite é barrado no servidor.
                    Deixar o botão vivo faria o financeiro preencher a venda
                    inteira para só então descobrir. */}
                {c.podeAprovar ? (
                  <Button asChild size="sm">
                    <Link href={`/vendas/nova?checklist=${c.id}`}>Aprovar</Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled title="Falta contrato ou comprovante de pagamento">
                    Aguardando documentos
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRecusando(recusando === c.id ? null : c.id);
                    setMotivo("");
                  }}
                >
                  Recusar
                </Button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {c.docs.map((d) => (
                <span key={d.rotulo} className="text-muted-foreground">
                  {d.rotulo}:{" "}
                  {d.arquivos.length === 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">faltando</span>
                  ) : (
                    d.arquivos.map((a) => (
                      <button
                        key={a.path}
                        type="button"
                        onClick={() => ver(a.path)}
                        className="mr-2 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                      >
                        <FileText className="size-3" />
                        {a.nome}
                      </button>
                    ))
                  )}
                </span>
              ))}
            </div>

            {/* A bonificação aparece já na fila: ela muda o que a construtora
                deve, e quem aprova a venda quer ver isso antes de aprovar. */}
            {c.bonificacao && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed px-3 py-2 text-xs">
                <span className="font-medium">Bonificação</span>
                <span className="text-muted-foreground">
                  {c.bonificacao.campanha} · {formatBRL(c.bonificacao.valor)}
                </span>
                {c.bonificacao.print.length === 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">sem o print</span>
                ) : (
                  c.bonificacao.print.map((a) => (
                    <button
                      key={a.path}
                      type="button"
                      onClick={() => ver(a.path)}
                      className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    >
                      <FileText className="size-3" />
                      {a.nome}
                    </button>
                  ))
                )}
                <span className="text-muted-foreground">
                  entra em Bonificações para conferência
                </span>
              </div>
            )}

            {recusando === c.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="O que precisa corrigir? O corretor vê este texto."
                  className="max-w-md"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pendente || !motivo.trim()}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await recusarChecklist(c.id, motivo);
                      if (r.error) toast.error("Não foi possível recusar", { description: r.error });
                      else {
                        toast.success("Submissão recusada.");
                        setRecusando(null);
                        router.refresh();
                      }
                    })
                  }
                >
                  {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirmar recusa
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
