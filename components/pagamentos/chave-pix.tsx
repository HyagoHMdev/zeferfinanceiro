"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

/**
 * A chave PIX de quem vai receber, na hora de pagar.
 *
 * Com botão de copiar porque chave digitada à mão é como se erra um pagamento:
 * um caractere trocado e o dinheiro vai para outra pessoa, ou o banco recusa
 * depois de todo o trabalho.
 */
export function ChavePix({
  chave,
  nome,
}: {
  chave: string | null;
  nome?: string | null;
}) {
  const [copiado, setCopiado] = useState(false);

  if (!chave?.trim()) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">Sem chave PIX cadastrada</span>
        {nome ? ` para ${nome}` : ""}. Cadastre em Configurações &gt; Cadastros para ela
        aparecer aqui na hora de pagar.
      </div>
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(chave!.trim());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie na mão.");
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
      title="Copiar a chave PIX"
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
            Chave PIX
          </span>
          <span className="block truncate font-medium">{chave}</span>
        </span>
      </span>
      {copiado ? (
        <Check className="size-4 shrink-0 text-success" />
      ) : (
        <Copy className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
