"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Pencil, Trash2, X } from "lucide-react";

import { formatBRL, formatData, mesAbrev } from "@/lib/format";
import type {
  AdiantamentoAvulsoRow,
  CorretorOpcao,
} from "@/lib/data/adiantamentos";
import {
  alternarReciboOk,
  excluirAdiantamentoAvulso,
  salvarReciboAdiantamento,
} from "@/app/(app)/adiantamentos/actions";
import { ReciboAssinado } from "@/components/recibo/recibo-assinado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdiantamentoFormDialog } from "@/components/adiantamentos/adiantamento-form-dialog";

const TODOS = "__todos__";

function mesLabel(ym: string): string {
  const [ano] = ym.split("-");
  return `${mesAbrev(`${ym}-01`)}/${ano}`;
}

export function AdiantamentosManager({
  adiantamentos,
  corretores,
  podeEditar,
}: {
  adiantamentos: AdiantamentoAvulsoRow[];
  corretores: CorretorOpcao[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [corretorId, setCorretorId] = useState(TODOS);
  const [mes, setMes] = useState(TODOS);

  const corretoresOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of adiantamentos)
      if (a.corretorNome) m.set(a.corretorId, a.corretorNome);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [adiantamentos]);

  const mesesOpts = useMemo(() => {
    const s = new Set<string>();
    for (const a of adiantamentos) s.add(a.data.slice(0, 7));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [adiantamentos]);

  const filtrados = useMemo(
    () =>
      adiantamentos.filter(
        (a) =>
          (corretorId === TODOS || a.corretorId === corretorId) &&
          (mes === TODOS || a.data.slice(0, 7) === mes),
      ),
    [adiantamentos, corretorId, mes],
  );

  const total = filtrados.reduce((s, a) => s + a.valor, 0);
  const temFiltro = corretorId !== TODOS || mes !== TODOS;

  async function toggleRecibo(a: AdiantamentoAvulsoRow, v: boolean) {
    const res = await alternarReciboOk(a.id, v);
    if (res?.error) {
      toast.error("Erro ao atualizar recibo", { description: res.error });
      return;
    }
    router.refresh();
  }

  if (adiantamentos.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum adiantamento registrado.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <Select value={corretorId} onValueChange={setCorretorId}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="Corretor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os corretores</SelectItem>
            {corretoresOpts.map(([id, nome]) => (
              <SelectItem key={id} value={id}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os meses</SelectItem>
            {mesesOpts.map((m) => (
              <SelectItem key={m} value={m}>
                {mesLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {temFiltro ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCorretorId(TODOS);
              setMes(TODOS);
            }}
          >
            <X className="size-4" />
            Limpar
          </Button>
        ) : null}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} de {adiantamentos.length}
        </span>
      </div>

      {filtrados.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum adiantamento com esses filtros.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corretor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Recibo</TableHead>
              <TableHead>Status</TableHead>
              {podeEditar ? <TableHead></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {a.corretorNome ?? "—"}
                </TableCell>
                <TableCell>{a.descricao ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatData(a.data)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(a.valor)}
                </TableCell>
                <TableCell className="text-center">
                  {podeEditar ? (
                    <Checkbox
                      checked={a.reciboOk}
                      onCheckedChange={(v) => toggleRecibo(a, v === true)}
                      aria-label="Recibo assinado recebido"
                    />
                  ) : a.reciboOk ? (
                    "OK"
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={a.descontado ? "success" : "warning"}>
                    {a.descontado ? "Descontado" : "A descontar"}
                  </Badge>
                </TableCell>
                {podeEditar ? (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ReciboAssinado
                        id={a.id}
                        value={a.reciboUrl}
                        salvar={salvarReciboAdiantamento}
                      />
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        aria-label="Recibo do adiantamento"
                        title="Recibo (imprimir / WhatsApp)"
                      >
                        <Link
                          href={`/recibo/adiantamento/${a.id}`}
                          target="_blank"
                        >
                          <FileText className="size-4" />
                        </Link>
                      </Button>
                      <AdiantamentoFormDialog
                        corretores={corretores}
                        adiantamento={a}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Editar">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <ExcluirAdiantamento id={a.id} />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>
                Total{temFiltro ? " (filtrado)" : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(total)}
              </TableCell>
              <TableCell colSpan={podeEditar ? 3 : 2}></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}

function ExcluirAdiantamento({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remover() {
    setBusy(true);
    const res = await excluirAdiantamentoAvulso(id);
    setBusy(false);
    if (res?.error) {
      toast.error("Erro ao excluir", { description: res.error });
      return;
    }
    toast.success("Adiantamento excluído");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Excluir">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir adiantamento?</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={remover} disabled={busy}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
