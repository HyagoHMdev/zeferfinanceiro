"use client";

import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface OpcaoMulti {
  valor: string;
  label: string;
}

/**
 * Filtro de várias opções ao mesmo tempo.
 *
 * Lista vazia significa "todas", e não "nenhuma": é o que a pessoa espera ao
 * abrir a tela, e evita a tabela nascer vazia esperando alguém marcar algo.
 *
 * O item não fecha o menu ao ser clicado (preventDefault no onSelect): o
 * normal aqui é marcar três ou quatro seguidos, e reabrir a cada clique
 * tornaria o filtro pior que o de uma opção só.
 */
export function MultiSelect({
  opcoes,
  selecionados,
  onChange,
  rotuloTodos,
  larguraClasse = "w-44",
}: {
  opcoes: OpcaoMulti[];
  selecionados: string[];
  onChange: (v: string[]) => void;
  rotuloTodos: string;
  larguraClasse?: string;
}) {
  const alternar = (valor: string) =>
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor],
    );

  const rotulo =
    selecionados.length === 0
      ? rotuloTodos
      : selecionados.length === 1
        ? (opcoes.find((o) => o.valor === selecionados[0])?.label ?? selecionados[0])
        : `${selecionados.length} selecionados`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("justify-between font-normal", larguraClasse)}
        >
          <span className="truncate">{rotulo}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onChange([]);
          }}
          className="gap-2"
        >
          <Check
            className={cn("size-4", selecionados.length === 0 ? "opacity-100" : "opacity-0")}
          />
          {rotuloTodos}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {opcoes.map((o) => {
          const marcado = selecionados.includes(o.valor);
          return (
            <DropdownMenuItem
              key={o.valor}
              onSelect={(e) => {
                e.preventDefault();
                alternar(o.valor);
              }}
              className="gap-2"
            >
              <Check className={cn("size-4", marcado ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{o.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
