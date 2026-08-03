"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { registrarPagamentoFuncionario } from "@/app/(app)/pagamentos/actions";
import { parseNumeroBR, formatBRL, formatData } from "@/lib/format";
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

export interface AdiantamentoAberto {
  id: string;
  data: string;
  valor: number;
  descricao: string | null;
}

export function PagarFuncionarioDialog({
  funcionarioId,
  nome,
  adiantamentos,
}: {
  funcionarioId: string;
  nome: string;
  adiantamentos: AdiantamentoAberto[];
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  // Todos os adiantamentos vêm marcados: descontar é o caminho esperado.
  const [marcados, setMarcados] = useState<string[]>(adiantamentos.map((a) => a.id));
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  // Ressincroniza a cada abertura. Sem isto a marcação fica congelada no
  // primeiro render da página: um adiantamento lançado depois aparece na lista
  // mas DESMARCADO, e o pagamento sai sem descontá-lo sem ninguém perceber.
  function alternarDialogo(abrir: boolean) {
    if (abrir) {
      setMarcados(adiantamentos.map((a) => a.id));
      setValor("");
      setObs("");
    }
    setAberto(abrir);
  }

  // Ter adiantamento em aberto e não descontar nenhum é possível (o usuário pode
  // querer pagar cheio), mas é raro o bastante para merecer confirmação.
  const nenhumMarcado = adiantamentos.length > 0 && marcados.length === 0;

  const bruto = parseNumeroBR(valor);
  const totalDesconto = adiantamentos
    .filter((a) => marcados.includes(a.id))
    .reduce((s, a) => s + Number(a.valor), 0);
  const liquido = bruto - totalDesconto;

  async function confirmar() {
    if (bruto <= 0) {
      toast.error("Informe o valor do pagamento.");
      return;
    }
    if (liquido < 0) {
      toast.error("Os adiantamentos passam do valor do pagamento.", {
        description: "Desmarque algum ou aumente o valor.",
      });
      return;
    }
    setSalvando(true);
    const res = await registrarPagamentoFuncionario({
      corretorId: funcionarioId,
      valorBruto: bruto,
      adiantamentoIds: marcados,
      observacoes: obs.trim() || null,
    });
    setSalvando(false);
    if (res.error) {
      toast.error("Erro ao registrar o pagamento", { description: res.error });
      return;
    }
    toast.success(`Pagamento de ${nome} registrado.`, {
      description: "O recibo está disponível na lista de pagamentos.",
    });
    setAberto(false);
    setValor("");
    setObs("");
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={alternarDialogo}>
      <DialogTrigger asChild>
        <Button size="sm">Pagar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar {nome}</DialogTitle>
          <DialogDescription>
            Informe o valor e escolha os adiantamentos a descontar. O que for
            descontado volta para o caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor-pag">Valor do pagamento</Label>
            <Input
              id="valor-pag"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>

          {adiantamentos.length > 0 ? (
            <div className="space-y-2">
              <Label>Adiantamentos a descontar</Label>
              <div className="space-y-1 rounded-md border p-2">
                {adiantamentos.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded p-2 text-sm hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marcados.includes(a.id)}
                        onChange={(e) =>
                          setMarcados((atual) =>
                            e.target.checked
                              ? [...atual, a.id]
                              : atual.filter((x) => x !== a.id),
                          )
                        }
                        className="h-4 w-4"
                      />
                      <span>
                        {formatData(a.data)}
                        {a.descricao ? (
                          <span className="text-muted-foreground"> · {a.descricao}</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="tabular-nums">{formatBRL(a.valor)}</span>
                  </label>
                ))}
              </div>
              {nenhumMarcado ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-400">
                  Nenhum adiantamento marcado. O pagamento vai sair cheio e os
                  adiantamentos continuarão em aberto.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem adiantamentos em aberto para descontar.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs-pag">
              Observação <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="obs-pag"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: salário de julho"
            />
          </div>

          <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
            <Linha rotulo="Valor do pagamento" valor={bruto} />
            <Linha rotulo="Adiantamentos" valor={-totalDesconto} />
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>A pagar agora</span>
              <span className="tabular-nums">{formatBRL(liquido)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando || bruto <= 0}>
            {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
            Registrar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{rotulo}</span>
      <span className="tabular-nums">{formatBRL(valor)}</span>
    </div>
  );
}
