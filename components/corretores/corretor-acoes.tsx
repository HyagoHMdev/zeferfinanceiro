"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, HandCoins, Gift, Wallet } from "lucide-react";

import { parseNumeroBR, formatBRL } from "@/lib/format";
import {
  registrarAdiantamento,
  registrarBonificacao,
  registrarPagamento,
} from "@/app/(app)/corretores/actions";
import { AnexoUpload } from "@/components/anexo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ResumoPagamento {
  valorBruto: number;
  totalBonificacoes: number;
  totalAdiantamentos: number;
  valorLiquido: number;
  temPendencia: boolean;
}

export function CorretorAcoes({
  corretorId,
  resumo,
}: {
  corretorId: string;
  resumo: ResumoPagamento;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <AdiantamentoDialog corretorId={corretorId} />
      <BonificacaoDialog corretorId={corretorId} />
      <PagamentoDialog corretorId={corretorId} resumo={resumo} />
    </div>
  );
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function AdiantamentoDialog({ corretorId }: { corretorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [reciboUrl, setReciboUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await registrarAdiantamento({
      corretor_id: corretorId,
      data,
      valor: parseNumeroBR(valor),
      descricao: descricao.trim() || null,
      recibo_url: reciboUrl,
    });
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao registrar", { description: res.error });
      return;
    }
    toast.success("Adiantamento registrado");
    setValor("");
    setDescricao("");
    setReciboUrl(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <HandCoins className="size-4" />
          Adiantamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo adiantamento</DialogTitle>
          <DialogDescription>
            Será descontado automaticamente no próximo pagamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="a-data">Data</Label>
              <Input
                id="a-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-valor">Valor</Label>
              <Input
                id="a-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-desc">Descrição</Label>
            <Input
              id="a-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Notebook, vale, etc."
            />
          </div>
          <div className="space-y-2">
            <Label>Recibo</Label>
            <AnexoUpload
              value={reciboUrl}
              onChange={setReciboUrl}
              pasta="adiantamentos"
              label="Recibo"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BonificacaoDialog({ corretorId }: { corretorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await registrarBonificacao({
      corretor_id: corretorId,
      data,
      valor: parseNumeroBR(valor),
      motivo: motivo.trim() || null,
    });
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao registrar", { description: res.error });
      return;
    }
    toast.success("Bonificação registrada");
    setValor("");
    setMotivo("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Gift className="size-4" />
          Bonificação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova bonificação</DialogTitle>
          <DialogDescription>
            Será somada ao próximo pagamento do corretor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="b-data">Data</Label>
              <Input
                id="b-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-valor">Valor</Label>
              <Input
                id="b-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-motivo">Motivo</Label>
            <Input
              id="b-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Meta batida"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PagamentoDialog({
  corretorId,
  resumo,
}: {
  corretorId: string;
  resumo: ResumoPagamento;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(hoje());

  async function confirmar() {
    setSaving(true);
    const res = await registrarPagamento(corretorId, data);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao pagar", { description: res.error });
      return;
    }
    toast.success("Pagamento registrado");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!resumo.temPendencia}>
          <Wallet className="size-4" />
          Registrar pagamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Agrupa todas as comissões pendentes, bonificações e adiantamentos em
            aberto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-data">Data do pagamento</Label>
            <Input
              id="p-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <Linha label="Comissões (bruto)" valor={resumo.valorBruto} />
            <Linha label="(+) Bonificações" valor={resumo.totalBonificacoes} />
            <Linha label="(−) Adiantamentos" valor={-resumo.totalAdiantamentos} />
            <div className="mt-1 border-t pt-1">
              <Linha label="Valor líquido a pagar" valor={resumo.valorLiquido} strong />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={confirmar} disabled={saving || !resumo.temPendencia}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({
  label,
  valor,
  strong,
}: {
  label: string;
  valor: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {formatBRL(valor)}
      </span>
    </div>
  );
}
