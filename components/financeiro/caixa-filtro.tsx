"use client";

import { useRouter, usePathname } from "next/navigation";

import { mesAbrev } from "@/lib/format";
import type { CaixaModo } from "@/lib/data/financeiro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODOS = "__todos__";

function mesLabel(mk: string): string {
  const [ano] = mk.split("-");
  return `${mesAbrev(`${mk}-01`)}/${ano}`;
}

export function CaixaFiltro({
  meses,
  mesAtual,
  modoAtual,
}: {
  meses: string[];
  mesAtual: string | null;
  modoAtual: CaixaModo;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function irPara(mes: string | null, modo: CaixaModo) {
    if (!mes) {
      router.push(pathname);
      return;
    }
    router.push(`${pathname}?mes=${mes}&modo=${modo}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={mesAtual ?? TODOS}
        onValueChange={(v) => irPara(v === TODOS ? null : v, modoAtual)}
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os meses</SelectItem>
          {meses.map((m) => (
            <SelectItem key={m} value={m}>
              {mesLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mesAtual ? (
        <Select
          value={modoAtual}
          onValueChange={(v) => irPara(mesAtual, v as CaixaModo)}
        >
          <SelectTrigger size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="movimento">Movimento do mês</SelectItem>
            <SelectItem value="acumulado">Acumulado até o mês</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
