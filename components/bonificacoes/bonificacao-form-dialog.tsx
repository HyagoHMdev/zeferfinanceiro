"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { criarBonificacaoManual } from "@/app/(app)/bonificacoes/actions";
import { parseNumeroBR } from "@/lib/format";
import { DocumentosUpload, type DocumentoVenda } from "@/components/documentos-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NONE = "__none__";
const hojeISO = () => new Date().toISOString().slice(0, 10);

export interface CorretorOpcao {
  id: string;
  nome: string;
}

export interface VendaOpcao {
  id: string;
  corretorId: string | null;
  label: string;
}

/**
 * Lançamento manual de bonificação.
 *
 * Nem toda campanha chega pela venda: a construtora manda uma lista fechada no
 * fim do mês, ou o bônus é de uma venda antiga, anterior ao campo no
 * checklist. Entra já aprovada, porque quem lança aqui é quem aprovaria.
 */
export function BonificacaoFormDialog({
  corretores,
  vendas,
}: {
  corretores: CorretorOpcao[];
  vendas: VendaOpcao[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [corretorId, setCorretorId] = useState(NONE);
  const [campanha, setCampanha] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [vendaId, setVendaId] = useState(NONE);
  const [observacao, setObservacao] = useState("");
  const [anexos, setAnexos] = useState<DocumentoVenda[]>([]);

  // Escolhido o corretor, só as vendas dele fazem sentido na lista.
  const vendasDoCorretor =
    corretorId === NONE ? vendas : vendas.filter((v) => v.corretorId === corretorId);

  function limpar() {
    setCorretorId(NONE);
    setCampanha("");
    setValor("");
    setData(hojeISO());
    setVendaId(NONE);
    setObservacao("");
    setAnexos([]);
  }

  async function salvar() {
    if (corretorId === NONE) return toast.error("Escolha o corretor.");
    setSaving(true);
    const res = await criarBonificacaoManual({
      corretorId,
      campanha: campanha.trim(),
      valor: parseNumeroBR(valor),
      data,
      vendaId: vendaId === NONE ? null : vendaId,
      observacao: observacao.trim() || undefined,
      anexos,
    });
    setSaving(false);
    if (res?.error) return toast.error(res.error);
    toast.success("Bonificação lançada.");
    limpar();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) limpar();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nova bonificação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova bonificação</DialogTitle>
          <DialogDescription>
            Para o bônus que não veio pela venda. Entra já aprovada, esperando a
            construtora pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Corretor</Label>
            <Select value={corretorId} onValueChange={setCorretorId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o corretor" />
              </SelectTrigger>
              <SelectContent>
                {corretores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bf-campanha">Campanha</Label>
            <Input
              id="bf-campanha"
              value={campanha}
              onChange={(e) => setCampanha(e.target.value)}
              placeholder="Zaya agosto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bf-valor">Valor do bônus</Label>
            <Input
              id="bf-valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="3.000,00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bf-data">Data</Label>
            <Input
              id="bf-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Venda (opcional)</Label>
            <Select value={vendaId} onValueChange={setVendaId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem venda vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem venda vinculada</SelectItem>
                {vendasDoCorretor.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bf-obs">Observação</Label>
            <Input
              id="bf-obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="De onde veio o número, o que combinaram"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Print da campanha</Label>
            <DocumentosUpload value={anexos} onChange={setAnexos} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Lançar bonificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
