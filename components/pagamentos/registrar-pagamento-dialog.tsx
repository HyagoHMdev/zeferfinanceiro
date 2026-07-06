"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, HandCoins } from "lucide-react";

import { registrarPagamento } from "@/app/(app)/pagamentos/actions";
import type { CorretorPendente } from "@/lib/data/pagamentos";
import { formatBRL, formatData } from "@/lib/format";
import { Button } from "@/components/ui/button";
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

  async function confirmar() {
    setSaving(true);
    const res = await registrarPagamento({ corretorId: corretor.corretorId });
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
            As comissões abaixo serão marcadas como pagas e um recibo será gerado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-1 font-semibold">Comissões ({corretor.comissoes.length})</div>
            <ul className="space-y-1">
              {corretor.comissoes.map((c) => (
                <li key={c.vendaId} className="flex justify-between gap-4">
                  <span className="truncate text-muted-foreground">
                    {c.empreendimento ?? "Venda"}
                    {c.cliente ? ` — ${c.cliente}` : ""} · {formatData(c.dataVenda)}
                  </span>
                  <span className="tabular-nums">{formatBRL(c.liquidoCorretor)}</span>
                </li>
              ))}
            </ul>
          </div>

          {corretor.adiantamentos.length > 0 ? (
            <div>
              <div className="mb-1 font-semibold">
                Adiantamentos descontados ({corretor.adiantamentos.length})
              </div>
              <ul className="space-y-1">
                {corretor.adiantamentos.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <span className="truncate text-muted-foreground">
                      {a.descricao ?? "Adiantamento"} · {formatData(a.data)}
                    </span>
                    <span className="tabular-nums">- {formatBRL(a.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-1 border-t pt-3">
            <div className="flex justify-between">
              <span>Comissões (bruto)</span>
              <span className="tabular-nums">{formatBRL(corretor.totalBruto)}</span>
            </div>
            <div className="flex justify-between">
              <span>(−) Adiantamentos</span>
              <span className="tabular-nums">{formatBRL(corretor.totalAdiantamentos)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Líquido a pagar</span>
              <span className="tabular-nums">{formatBRL(corretor.liquido)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button onClick={confirmar} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
