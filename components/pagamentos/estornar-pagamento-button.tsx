"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";

import { estornarPagamento } from "@/app/(app)/pagamentos/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EstornarPagamentoButton({ pagamentoId }: { pagamentoId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function estornar() {
    setSaving(true);
    const res = await estornarPagamento({ pagamentoId });
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao estornar", { description: res.error });
      return;
    }
    toast.success("Pagamento estornado");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Estornar pagamento">
          <Undo2 className="size-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estornar pagamento?</DialogTitle>
          <DialogDescription>
            As comissões voltarão para &quot;aguardando liberação&quot; e o
            registro do pagamento (e recibo) será removido. Os adiantamentos são
            desvinculados, não excluídos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={estornar} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Estornar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
