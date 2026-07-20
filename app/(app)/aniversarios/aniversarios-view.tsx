"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  criarAniversario,
  atualizarAniversario,
  excluirAniversario,
} from "./actions";

export type AniversarioRow = {
  id: string;
  nome: string;
  dia: number | null;
  mes: number | null;
  telefone: string | null;
};

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function waLink(tel: string | null, nome: string): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  const primeiro = nome.trim().split(/\s+/)[0];
  const msg = encodeURIComponent(
    `Feliz aniversário, ${primeiro}! 🎉 A equipe Zefer deseja um dia incrível e tudo de bom para você. 🥳`,
  );
  return `https://wa.me/${d}?text=${msg}`;
}

type FormState = { id: string | null; nome: string; dia: string; mes: string; telefone: string };
const VAZIO: FormState = { id: null, nome: "", dia: "", mes: "", telefone: "" };

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AniversariosView({
  aniversariantes,
  podeEditar,
}: {
  aniversariantes: AniversarioRow[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? aniversariantes.filter((a) => a.nome.toLowerCase().includes(t)) : aniversariantes;
  }, [aniversariantes, busca]);

  const grupos = useMemo(() => {
    const porMes: AniversarioRow[][] = Array.from({ length: 13 }, () => []);
    const semData: AniversarioRow[] = [];
    for (const a of filtrados) {
      if (a.mes && a.mes >= 1 && a.mes <= 12) porMes[a.mes].push(a);
      else semData.push(a);
    }
    for (let m = 1; m <= 12; m++) {
      porMes[m].sort((x, y) => (x.dia ?? 99) - (y.dia ?? 99) || x.nome.localeCompare(y.nome));
    }
    semData.sort((x, y) => x.nome.localeCompare(y.nome));
    return { porMes, semData };
  }, [filtrados]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function salvar() {
    if (!form) return;
    setBusy(true);
    const input = {
      nome: form.nome,
      dia: form.dia === "" ? null : Number(form.dia),
      mes: form.mes === "" ? null : Number(form.mes),
      telefone: form.telefone || null,
    };
    const res = form.id ? await atualizarAniversario(form.id, input) : await criarAniversario(input);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Aniversariante atualizado" : "Aniversariante adicionado");
    setForm(null);
    router.refresh();
  }

  async function excluir(a: AniversarioRow) {
    if (!confirm(`Excluir ${a.nome}?`)) return;
    const res = await excluirAniversario(a.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  const total = aniversariantes.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome…"
          className="max-w-xs"
        />
        {podeEditar && (
          <Button onClick={() => setForm({ ...VAZIO })}>Novo aniversariante</Button>
        )}
      </div>

      {form && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.dia}
                onChange={(e) => set("dia", e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <Label>Mês</Label>
              <select value={form.mes} onChange={(e) => set("mes", e.target.value)} className={selectCls}>
                <option value="">—</option>
                {MESES.slice(1).map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>WhatsApp / Telefone</Label>
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(47) 90000-0000" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {filtrados.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum aniversariante encontrado.
        </Card>
      ) : (
        <div className="space-y-5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const lista = grupos.porMes[m];
            if (lista.length === 0) return null;
            return (
              <div key={m}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {MESES[m]} · {lista.length}
                </h2>
                <Card className="divide-y overflow-hidden py-0">
                  {lista.map((a) => (
                    <Linha key={a.id} a={a} podeEditar={podeEditar}
                      onEditar={() => setForm({ id: a.id, nome: a.nome, dia: a.dia?.toString() ?? "", mes: a.mes?.toString() ?? "", telefone: a.telefone ?? "" })}
                      onExcluir={() => excluir(a)} />
                  ))}
                </Card>
              </div>
            );
          })}

          {grupos.semData.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sem data · {grupos.semData.length}
              </h2>
              <Card className="divide-y overflow-hidden py-0">
                {grupos.semData.map((a) => (
                  <Linha key={a.id} a={a} podeEditar={podeEditar} semData
                    onEditar={() => setForm({ id: a.id, nome: a.nome, dia: "", mes: "", telefone: a.telefone ?? "" })}
                    onExcluir={() => excluir(a)} />
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({
  a,
  podeEditar,
  semData,
  onEditar,
  onExcluir,
}: {
  a: AniversarioRow;
  podeEditar: boolean;
  semData?: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const link = waLink(a.telefone, a.nome);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {!semData && (
        <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums text-primary">{a.dia ?? "·"}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.nome}</p>
        {a.telefone && <p className="truncate text-xs text-muted-foreground">{a.telefone}</p>}
      </div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full bg-[#25D366]/15 px-2.5 py-1 text-xs font-semibold text-[#128C33] transition hover:bg-[#25D366]/25"
        >
          WhatsApp
        </a>
      )}
      {podeEditar && (
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <button onClick={onEditar} className="rounded px-1 hover:text-foreground" title="Editar">✎</button>
          <button onClick={onExcluir} className="rounded px-1 hover:text-destructive" title="Excluir">✕</button>
        </div>
      )}
    </div>
  );
}
