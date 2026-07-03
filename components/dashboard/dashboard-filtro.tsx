"use client";

import { useRouter, usePathname } from "next/navigation";

import { MESES } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ANO_TODO = "__ano__";

export function DashboardFiltro({
  anos,
  ano,
  mes,
}: {
  anos: number[];
  ano: number;
  mes: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function irPara(novoAno: number, novoMes: number | null) {
    const qs = novoMes
      ? `?ano=${novoAno}&mes=${novoMes}`
      : `?ano=${novoAno}`;
    router.push(`${pathname}${qs}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={String(ano)}
        onValueChange={(v) => irPara(Number(v), mes)}
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anos.map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={mes ? String(mes) : ANO_TODO}
        onValueChange={(v) => irPara(ano, v === ANO_TODO ? null : Number(v))}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANO_TODO}>Ano todo</SelectItem>
          {MESES.map((nome, i) => (
            <SelectItem key={nome} value={String(i + 1)}>
              {nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
