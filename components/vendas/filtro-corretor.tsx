"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODOS = "__todos__";

/**
 * Filtro por corretor. Navega pela URL (?corretor=id) em vez de filtrar no
 * cliente: assim o servidor devolve só as vendas do corretor e os TOTAIS do
 * rodapé já saem do recorte, sem precisar recalcular em dois lugares.
 */
export function FiltroCorretor({
  corretores,
  valor,
}: {
  corretores: { id: string; nome: string }[];
  valor: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function mudar(v: string) {
    const novos = new URLSearchParams(params.toString());
    if (v === TODOS) novos.delete("corretor");
    else novos.set("corretor", v);
    const qs = novos.toString();
    router.push(qs ? `/vendas?${qs}` : "/vendas");
  }

  return (
    <Select value={valor ?? TODOS} onValueChange={mudar}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Todos os corretores" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos os corretores</SelectItem>
        {corretores.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
