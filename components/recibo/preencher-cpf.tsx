"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { salvarCpfCorretor } from "@/app/recibo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Banner (só na tela, escondido na impressão) para o corretor preencher o
 * próprio CPF quando ainda não está no cadastro. Salva e recarrega o recibo.
 */
export function PreencherCpf({ corretorId }: { corretorId: string }) {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    const res = await salvarCpfCorretor(corretorId, cpf);
    setSaving(false);
    if (res?.error) {
      toast.error("Não foi possível salvar o CPF", { description: res.error });
      return;
    }
    toast.success("CPF salvo");
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-zinc-800 print:hidden">
      <div className="mb-2 font-medium">Preencha seu CPF para completar o recibo</div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="max-w-[220px] bg-white"
        />
        <Button type="button" onClick={salvar} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar CPF
        </Button>
      </div>
    </div>
  );
}
