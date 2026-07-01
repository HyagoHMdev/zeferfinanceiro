"use client";

import { useRouter, usePathname } from "next/navigation";

import { ENTRADA_TIPO_LABEL, type EntradaTipo } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIPOS: EntradaTipo[] = [
  "comissao",
  "bonificacao",
  "premiacao",
  "investidor",
  "outras",
];

export function EntradaTipoFiltro({ atual }: { atual: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(v: string) {
    const qs = v === "todos" ? "" : `?tipo=${v}`;
    router.push(`${pathname}${qs}`);
  }

  return (
    <Select value={atual} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os tipos</SelectItem>
        {TIPOS.map((t) => (
          <SelectItem key={t} value={t}>
            {ENTRADA_TIPO_LABEL[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
