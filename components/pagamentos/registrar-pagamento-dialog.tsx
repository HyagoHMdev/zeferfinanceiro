"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, HandCoins } from "lucide-react";

import { registrarPagamento } from "@/app/(app)/pagamentos/actions";
import type { CorretorPendente } from "@/lib/data/pagamentos";
import { round2 } from "@/lib/calculos";
import { formatBRL, formatData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RegistrarPagamentoDialog({ corretor }: { corretor: CorretorPendente }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seleção: começa com tudo marcado (pagar todas as comissões e descontar todos
  // os adiantamentos), mas dá para escolher só algumas.
  const [vendasSel, setVendasSel] = useState<Set<string>>(
    () => new Set(corretor.comissoes.map((c) => c.vendaId)),
  );
  const [adiSel, setAdiSel] = useState<Set<string>>(
    () => new Set(corretor.adiantamentos.map((a) => a.id)),
  );

  // Um adiantamento atrelado a uma venda só entra se aquela venda for paga.
  // Vales avulsos (vendaId null) ficam sempre disponíveis.
  const adiDisponivel = (vendaId: string | null) => vendaId === null || vendasSel.has(vendaId);

  const resumo = useMemo(() => {
    const comissoes = corretor.comissoes.filter((c) => vendasSel.has(c.vendaId));
    const adiantamentos = corretor.adiantamentos.filter(
      (a) => adiDisponivel(a.vendaId) && adiSel.has(a.id),
    );
    const comissaoBruta = round2(comissoes.reduce((s, c) => s + c.comissaoBruta, 0));
    const imposto = round2(comissoes.reduce((s, c) => s + c.imposto, 0));
    const totalBruto = round2(comissoes.reduce((s, c) => s + c.liquidoCorretor, 0));
    const totalAdiantamentos = round2(adiantamentos.reduce((s, a) => s + a.valor, 0));
    const liquido = round2(totalBruto - totalAdiantamentos);
    return {
      nComissoes: comissoes.length,
      adiantamentosIds: adiantamentos.map((a) => a.id),
      comissaoBruta,
      imposto,
      totalBruto,
      totalAdiantamentos,
      liquido,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corretor, vendasSel, adiSel]);

  function toggleVenda(vendaId: string, on: boolean) {
    setVendasSel((prev) => {
      const n = new Set(prev);
      if (on) n.add(vendaId);
      else n.delete(vendaId);
      return n;
    });
  }
  function toggleTodasComissoes(on: boolean) {
    setVendasSel(on ? new Set(corretor.comissoes.map((c) => c.vendaId)) : new Set());
  }
  function toggleAdi(id: string, on: boolean) {
    setAdiSel((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  const todasComissoes = vendasSel.size === corretor.comissoes.length;

  async function confirmar() {
    if (resumo.nComissoes === 0) {
      toast.error("Selecione ao menos uma comissão para pagar.");
      return;
    }
    setSaving(true);
    const res = await registrarPagamento({
      corretorId: corretor.corretorId,
      vendaIds: [...vendasSel],
      adiantamentoIds: resumo.adiantamentosIds,
    });
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao registrar pagamento", { description: res.error });
      return;
    }
    toast.success("Pagamento registrado");
    setOpen(false);
    router.refresh();
    // Abre o recibo imprimível em nova aba.
    if (res?.pagamentoId) {
      window.open(`/recibo/pagamento/${res.pagamentoId}`, "_blank");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <HandCoins className="size-4" />
          Registrar pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar {corretor.corretorNome ?? "corretor"}</DialogTitle>
          <DialogDescription>
            Escolha quais comissões pagar. As selecionadas serão marcadas como pagas e um recibo
            será gerado para o corretor assinar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">Comissões ({resumo.nComissoes}/{corretor.comissoes.length})</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-muted-foreground">
                <Checkbox
                  checked={todasComissoes}
                  onCheckedChange={(v) => toggleTodasComissoes(v === true)}
                />
                Todas
              </label>
            </div>
            <ul className="space-y-1">
              {corretor.comissoes.map((c) => {
                const marcada = vendasSel.has(c.vendaId);
                return (
                  <li key={c.vendaId} className="flex items-start gap-2">
                    <Checkbox
                      id={`c-${c.vendaId}`}
                      checked={marcada}
                      onCheckedChange={(v) => toggleVenda(c.vendaId, v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor={`c-${c.vendaId}`} className="flex flex-1 cursor-pointer justify-between gap-4">
                      <span className={marcada ? "" : "text-muted-foreground line-through"}>
                        <span className="block truncate">
                          {c.empreendimento ?? "Venda"}
                          {c.cliente ? ` — ${c.cliente}` : ""} · {formatData(c.dataVenda)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Bruto {formatBRL(c.comissaoBruta)} · imposto {formatBRL(c.imposto)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatBRL(c.liquidoCorretor)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {corretor.adiantamentos.length > 0 ? (
            <div>
              <div className="mb-1 font-semibold">
                Adiantamentos a descontar ({corretor.adiantamentos.length})
              </div>
              <ul className="space-y-1">
                {corretor.adiantamentos.map((a) => {
                  const disponivel = adiDisponivel(a.vendaId);
                  const marcada = disponivel && adiSel.has(a.id);
                  return (
                    <li key={a.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`a-${a.id}`}
                        checked={marcada}
                        disabled={!disponivel}
                        onCheckedChange={(v) => toggleAdi(a.id, v === true)}
                      />
                      <label
                        htmlFor={`a-${a.id}`}
                        className={`flex flex-1 cursor-pointer justify-between gap-4 ${
                          disponivel ? "" : "opacity-50"
                        }`}
                      >
                        <span className="truncate text-muted-foreground">
                          {a.descricao ?? "Adiantamento"} · {formatData(a.data)}
                          {!disponivel ? " (comissão não selecionada)" : ""}
                        </span>
                        <span className="shrink-0 tabular-nums">- {formatBRL(a.valor)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="space-y-1 border-t pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Comissão bruta</span>
              <span className="tabular-nums">{formatBRL(resumo.comissaoBruta)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>(−) Imposto (NF)</span>
              <span className="tabular-nums">{formatBRL(resumo.imposto)}</span>
            </div>
            <div className="flex justify-between">
              <span>Comissão líquida</span>
              <span className="tabular-nums">{formatBRL(resumo.totalBruto)}</span>
            </div>
            <div className="flex justify-between">
              <span>(−) Adiantamentos</span>
              <span className="tabular-nums">{formatBRL(resumo.totalAdiantamentos)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Líquido a pagar</span>
              <span className="tabular-nums">{formatBRL(resumo.liquido)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button onClick={confirmar} disabled={saving || resumo.nComissoes === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
