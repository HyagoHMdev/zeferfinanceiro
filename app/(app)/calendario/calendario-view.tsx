"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  alternarConcluida,
  atualizarAtividade,
  criarAtividade,
  excluirAtividade,
  excluirSerie,
  moverAtividade,
  type AtividadeInput,
} from "./actions";

export type Atividade = {
  id: string;
  data: string;
  titulo: string;
  descricao: string | null;
  categoria: AtividadeInput["categoria"];
  hora: string | null;
  concluida: boolean;
  serie_id: string | null;
  repeticao: string;
};

const CATEGORIAS: { valor: Atividade["categoria"]; label: string; cor: string }[] = [
  { valor: "geral", label: "Geral", cor: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  { valor: "pagamento", label: "Pagamento", cor: "bg-red-500/15 text-red-700 dark:text-red-300" },
  { valor: "recebimento", label: "Recebimento", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { valor: "reuniao", label: "Reunião", cor: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { valor: "prazo", label: "Prazo", cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
];
const corDe = (c: Atividade["categoria"]) =>
  CATEGORIAS.find((x) => x.valor === c)?.cor ?? CATEGORIAS[0].cor;

const REPETICOES: { valor: string; label: string; resumo: string }[] = [
  { valor: "nenhuma", label: "Não repete", resumo: "" },
  { valor: "semanal", label: "Toda semana", resumo: "26 semanas (6 meses)" },
  { valor: "quinzenal", label: "A cada 15 dias", resumo: "13 vezes (6 meses)" },
  { valor: "mensal", label: "Todo mês", resumo: "12 meses" },
];

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-08-17" sem passar por Date: evita o fuso jogar para o dia anterior. */
function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Semanas do mês, cada uma com 7 dias (inclui vizinhos para fechar a grade). */
function gradeDoMes(mes: string): { iso: string; dia: number; doMes: boolean }[][] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const inicio = new Date(primeiro);
  inicio.setUTCDate(1 - primeiro.getUTCDay());

  const semanas: { iso: string; dia: number; doMes: boolean }[][] = [];
  const cursor = new Date(inicio);
  for (let s = 0; s < 6; s++) {
    const semana = [];
    for (let d = 0; d < 7; d++) {
      semana.push({
        iso: iso(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()),
        dia: cursor.getUTCDate(),
        doMes: cursor.getUTCMonth() === m - 1,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    semanas.push(semana);
    // Para de desenhar quando a semana seguinte já saiu do mês.
    if (cursor.getUTCMonth() !== m - 1 && semanas.length >= 4) break;
  }
  return semanas;
}

/** O que o formulário carrega: a atividade + de onde ela veio. */
type FormAtividade = AtividadeInput & { id?: string; serie_id?: string | null };

const VAZIO = (data: string): FormAtividade => ({
  data,
  titulo: "",
  descricao: "",
  categoria: "geral",
  hora: "",
  repeticao: "nenhuma",
});

export function CalendarioView({
  mes,
  atividades,
  podeEditar,
}: {
  mes: string;
  atividades: Atividade[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormAtividade | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const [ano, m] = mes.split("-").map(Number);
  const semanas = gradeDoMes(mes);
  const hoje = hojeISO();

  const porDia = new Map<string, Atividade[]>();
  for (const a of atividades) {
    const lista = porDia.get(a.data) ?? [];
    lista.push(a);
    porDia.set(a.data, lista);
  }

  function irPara(delta: number) {
    const d = new Date(Date.UTC(ano, m - 1 + delta, 1));
    router.push(`/calendario?mes=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    const res = form.id
      ? await atualizarAtividade(form.id, form)
      : await criarAtividade(form);
    setSalvando(false);
    if (res?.error) return toast.error("Não foi possível salvar", { description: res.error });
    setForm(null);
    router.refresh();
  }

  async function concluir(a: Atividade) {
    const res = await alternarConcluida(a.id, !a.concluida);
    if (res?.error) return toast.error("Erro", { description: res.error });
    router.refresh();
  }

  async function remover() {
    if (!form?.id) return;
    // Numa série, apagar só a ocorrência ou todas daqui pra frente são coisas
    // muito diferentes: perguntar evita apagar meio ano por engano.
    const daSerie = !!form.serie_id;
    if (daSerie) {
      const todas = window.confirm(
        "Esta atividade se repete.\n\n" +
          "OK apaga esta e TODAS as futuras da série.\n" +
          "Cancelar apaga só esta.",
      );
      const res = todas ? await excluirSerie(form.id) : await excluirAtividade(form.id);
      if (res?.error) return toast.error("Erro", { description: res.error });
    } else {
      if (!window.confirm("Excluir esta atividade?")) return;
      const res = await excluirAtividade(form.id);
      if (res?.error) return toast.error("Erro", { description: res.error });
    }
    setForm(null);
    router.refresh();
  }

  async function soltarEm(dia: string) {
    if (!arrastando) return;
    const id = arrastando;
    setArrastando(null);
    const res = await moverAtividade(id, dia);
    if (res?.error) return toast.error("Não foi possível mover", { description: res.error });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => irPara(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-48 text-center text-lg font-semibold capitalize">
            {MESES[m - 1]} de {ano}
          </span>
          <Button variant="outline" size="icon" onClick={() => irPara(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => router.push("/calendario")}>
            Hoje
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {CATEGORIAS.map((c) => (
            <span key={c.valor} className={`rounded px-2 py-0.5 text-xs ${c.cor}`}>
              {c.label}
            </span>
          ))}
          {podeEditar && (
            <Button onClick={() => setForm(VAZIO(hoje))}>
              <Plus className="mr-1 h-4 w-4" />
              Nova atividade
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-px text-xs font-medium text-muted-foreground">
            {DIAS.map((d) => (
              <div key={d} className="px-2 py-1 text-center capitalize">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-border">
            {semanas.flat().map((celula) => {
              const doDia = porDia.get(celula.iso) ?? [];
              const ehHoje = celula.iso === hoje;
              return (
                <div
                  key={celula.iso}
                  onDragOver={(e) => podeEditar && e.preventDefault()}
                  onDrop={() => podeEditar && soltarEm(celula.iso)}
                  className={`min-h-28 bg-background p-1.5 ${
                    celula.doMes ? "" : "opacity-40"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        ehHoje ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {celula.dia}
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => setForm(VAZIO(celula.iso))}
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100 sm:opacity-0 sm:hover:opacity-100"
                        title="Adicionar atividade neste dia"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {doDia.map((a) => (
                      <div
                        key={a.id}
                        draggable={podeEditar}
                        onDragStart={() => setArrastando(a.id)}
                        className={`group flex items-start gap-1 rounded px-1.5 py-1 text-xs ${corDe(
                          a.categoria,
                        )} ${a.concluida ? "opacity-50" : ""} ${podeEditar ? "cursor-grab" : ""}`}
                      >
                        {podeEditar && (
                          <input
                            type="checkbox"
                            checked={a.concluida}
                            onChange={() => concluir(a)}
                            className="mt-0.5 h-3 w-3 shrink-0"
                            title="Marcar como feita"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            podeEditar &&
                            setForm({
                              id: a.id,
                              data: a.data,
                              titulo: a.titulo,
                              descricao: a.descricao ?? "",
                              categoria: a.categoria,
                              hora: a.hora ? a.hora.slice(0, 5) : "",
                              repeticao: "nenhuma",
                              serie_id: a.serie_id,
                            })
                          }
                          className={`min-w-0 flex-1 text-left ${a.concluida ? "line-through" : ""}`}
                        >
                          {a.hora ? <b className="mr-1">{a.hora.slice(0, 5)}</b> : null}
                          {a.serie_id ? <span title="Se repete">↻ </span> : null}
                          {a.titulo}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={form !== null} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ag-titulo">O que precisa ser feito</Label>
                <Input
                  id="ag-titulo"
                  autoFocus
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex.: pagar boleto da construtora"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ag-data">Dia</Label>
                  <Input
                    id="ag-data"
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ag-hora">Hora (opcional)</Label>
                  <Input
                    id="ag-hora"
                    type="time"
                    value={form.hora ?? ""}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.categoria}
                    onValueChange={(v) =>
                      setForm({ ...form, categoria: v as Atividade["categoria"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.valor} value={c.valor}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.id ? (
                form.serie_id ? (
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Faz parte de uma série que se repete. A edição aqui vale só para este dia.
                  </p>
                ) : null
              ) : (
                <div className="space-y-2">
                  <Label>Repetir</Label>
                  <Select
                    value={form.repeticao ?? "nenhuma"}
                    onValueChange={(v) =>
                      setForm({ ...form, repeticao: v as AtividadeInput["repeticao"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPETICOES.map((r) => (
                        <SelectItem key={r.valor} value={r.valor}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.repeticao && form.repeticao !== "nenhuma" && (
                    <p className="text-xs text-muted-foreground">
                      Serão criadas {REPETICOES.find((r) => r.valor === form.repeticao)?.resumo}, a
                      partir do dia escolhido. Cada uma pode ser marcada, movida ou apagada sozinha.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ag-desc">Observações</Label>
                <Textarea
                  id="ag-desc"
                  rows={3}
                  value={form.descricao ?? ""}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {form?.id ? (
              <Button variant="ghost" onClick={remover} className="text-destructive">
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando || !form?.titulo.trim()}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
