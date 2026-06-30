"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { excluirEntrada } from "@/app/(app)/entradas/actions";
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

export function EntradaDelete({ id }: { id: string }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [open, setOpen] = useState(false);

  async function remover() {
    setRemoving(true);
    const res = await excluirEntrada(id);
    setRemoving(false);
    if (res?.error) {
      toast.error("Erro ao excluir", { description: res.error });
      return;
    }
    toast.success("Entrada excluída");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Excluir">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir entrada?</DialogTitle>
          <DialogDescription>
            A entrada e sua distribuição serão removidas. Esta ação não pode ser
            desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={remover} disabled={removing}>
            {removing ? <Loader2 className="size-4 animate-spin" /> : null}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
