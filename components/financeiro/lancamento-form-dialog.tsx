"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { parseNumeroBR } from "@/lib/format";
import {
  criarLancamento,
  atualizarLancamento,
} from "@/app/(app)/financeiro/actions";
import type { LancamentoInput } from "@/lib/schemas/lancamento";
import {
  LANCAMENTO_STATUS_LABEL,
  type Lancamento,
  type LancamentoEscopo,
  type LancamentoNatureza,
  type LancamentoStatus,
  type Recorrencia,
} from "@/lib/types";
import type { CadastrosLancamento } from "@/lib/data/financeiro";
import { AnexoUpload } from "@/components/anexo-upload";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NONE = "__none__";
const STATUS: LancamentoStatus[] = ["pendente", "pago", "atrasado"];
const RECORRENCIAS: Recorrencia[] = ["nenhuma", "mensal", "anual"];
const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  nenhuma: "Não repete",
  mensal: "Mensal",
  anual: "Anual",
};
const NATUREZA_PESSOAL: { value: LancamentoNatureza; label: string }[] = [
  { value: "saida_pessoal", label: "Saída" },
  { value: "entrada_pessoal", label: "Entrada" },
];

const TIPOS_COM_CATEGORIA: LancamentoNatureza[] = [
  "custo_fixo",
  "despesa_variavel",
  "investimento",
];

function competenciaParaMonth(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 7);
  return iso.slice(0, 7);
}

interface Props {
  escopoFixo: LancamentoEscopo;
  naturezaFixa?: LancamentoNatureza;
  cadastros: CadastrosLancamento;
  lancamento?: Lancamento;
  trigger: React.ReactNode;
}

export function LancamentoFormDialog({
  escopoFixo,
  naturezaFixa,
  cadastros,
  lancamento,
  trigger,
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(lancamento);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [natureza, setNatureza] = useState<LancamentoNatureza>(
    lancamento?.natureza ?? naturezaFixa ?? "saida_pessoal",
  );
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState(lancamento?.categoria_id ?? NONE);
  const [valor, setValor] = useState(lancamento ? String(lancamento.valor) : "");
  const [competencia, setCompetencia] = useState(
    competenciaParaMonth(lancamento?.competencia),
  );
  const [vencimento, setVencimento] = useState(lancamento?.data_vencimento ?? "");
  const [status, setStatus] = useState<LancamentoStatus>(
    lancamento?.status ?? "pendente",
  );
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("nenhuma");
  const [repeticoes, setRepeticoes] = useState("1");
  const [contaId, setContaId] = useState(lancamento?.conta_id ?? NONE);
  const [centroId, setCentroId] = useState(lancamento?.centro_custo_id ?? NONE);
  const [fornecedorId, setFornecedorId] = useState(
    lancamento?.fornecedor_id ?? NONE,
  );
  const [anexoUrl, setAnexoUrl] = useState<string | null>(
    lancamento?.anexo_url ?? null,
  );
  const [escopoEdicao, setEscopoEdicao] = useState<"este" | "grupo">("este");

  const isGrupo = isEdit && Boolean(lancamento?.recorrencia_grupo);

  const categoriasFiltradas = TIPOS_COM_CATEGORIA.includes(natureza)
    ? cadastros.categorias.filter((c) => c.tipo === natureza)
    : cadastros.categorias;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: LancamentoInput = {
      escopo: escopoFixo,
      natureza: naturezaFixa ?? natureza,
      categoria_id: categoriaId === NONE ? null : categoriaId,
      descricao: descricao.trim(),
      valor: parseNumeroBR(valor),
      competencia,
      data_vencimento: vencimento || null,
      status,
      recorrencia: isEdit ? "nenhuma" : recorrencia,
      repeticoes: isEdit ? 1 : Math.max(1, Math.round(parseNumeroBR(repeticoes))),
      conta_id: contaId === NONE ? null : contaId,
      centro_custo_id: centroId === NONE ? null : centroId,
      fornecedor_id: fornecedorId === NONE ? null : fornecedorId,
      anexo_url: anexoUrl,
    };

    const res = lancamento
      ? await atualizarLancamento(lancamento.id, input, isGrupo ? escopoEdicao : "este")
      : await criarLancamento(input);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar", { description: res.error });
      return;
    }
    toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {escopoFixo === "pessoal" && !naturezaFixa ? (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={natureza}
                onValueChange={(v) => setNatureza(v as LancamentoNatureza)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATUREZA_PESSOAL.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="l-desc">Descrição</Label>
            <Input
              id="l-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="l-valor">Valor</Label>
              <Input
                id="l-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-comp">Competência (mês)</Label>
              <Input
                id="l-comp"
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {categoriasFiltradas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LancamentoStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LANCAMENTO_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-venc">Vencimento</Label>
              <Input
                id="l-venc"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {cadastros.contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de custo</Label>
              <Select value={centroId} onValueChange={setCentroId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {cadastros.centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {cadastros.fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit ? (
            <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/40 p-3">
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select
                  value={recorrencia}
                  onValueChange={(v) => setRecorrencia(v as Recorrencia)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORRENCIAS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {RECORRENCIA_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {recorrencia !== "nenhuma" ? (
                <div className="space-y-2">
                  <Label htmlFor="l-rep">Repetições</Label>
                  <Input
                    id="l-rep"
                    inputMode="numeric"
                    value={repeticoes}
                    onChange={(e) => setRepeticoes(e.target.value)}
                    placeholder="12"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Comprovante / Anexo</Label>
            <AnexoUpload value={anexoUrl} onChange={setAnexoUrl} pasta="lancamentos" />
          </div>

          {isGrupo ? (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <Label>Aplicar alteração a</Label>
              <Select
                value={escopoEdicao}
                onValueChange={(v) => setEscopoEdicao(v as "este" | "grupo")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="este">Somente este</SelectItem>
                  <SelectItem value="grupo">Todos deste grupo (recorrência)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Este lançamento faz parte de uma recorrência. &quot;Todos&quot;
                mantém o mês/vencimento de cada ocorrência.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
