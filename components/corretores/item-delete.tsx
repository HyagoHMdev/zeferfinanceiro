"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import {
  excluirAdiantamento,
  excluirBonificacao,
} from "@/app/(app)/corretores/actions";
import { Button } from "@/components/ui/button";

export function ItemDelete({
  tipo,
  id,
  corretorId,
}: {
  tipo: "adiantamento" | "bonificacao";
  id: string;
  corretorId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    const res =
      tipo === "adiantamento"
        ? await excluirAdiantamento(id, corretorId)
        : await excluirBonificacao(id, corretorId);
    setLoading(false);
    if (res?.error) {
      toast.error("Erro ao remover", { description: res.error });
      return;
    }
    toast.success("Removido");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={loading}
      aria-label="Remover"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4 text-destructive" />
      )}
    </Button>
  );
}
