"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { fracaoParaInputPct, inputPctParaFracao } from "@/lib/format";
import { salvarParametros } from "@/app/(app)/configuracoes/actions";
import type { Configuracoes } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CAMPOS: { key: keyof Configuracoes; label: string }[] = [
  { key: "percentual_comissao_padrao", label: "% Comissão padrão (construtora)" },
  { key: "percentual_parceiro_padrao", label: "% Repasse padrão a parceiros" },
  { key: "percentual_imposto_imobiliaria", label: "% Imposto da imobiliária" },
  { key: "percentual_imposto_nf_corretor", label: "% Imposto NF do corretor" },
  { key: "percentual_comissao_corretor_padrao", label: "% Comissão padrão do corretor" },
  { key: "percentual_dizimo", label: "% Dízimo" },
];

export function ParametrosForm({ config }: { config: Configuracoes }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const c of CAMPOS) v[c.key] = fracaoParaInputPct(Number(config[c.key]));
    return v;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const dados = {
      percentual_comissao_padrao: inputPctParaFracao(valores.percentual_comissao_padrao),
      percentual_parceiro_padrao: inputPctParaFracao(valores.percentual_parceiro_padrao),
      percentual_imposto_imobiliaria: inputPctParaFracao(valores.percentual_imposto_imobiliaria),
      percentual_imposto_nf_corretor: inputPctParaFracao(valores.percentual_imposto_nf_corretor),
      percentual_comissao_corretor_padrao: inputPctParaFracao(
        valores.percentual_comissao_corretor_padrao,
      ),
      percentual_dizimo: inputPctParaFracao(valores.percentual_dizimo),
    };
    const res = await salvarParametros(dados);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar", { description: res.error });
      return;
    }
    toast.success("Parâmetros atualizados");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <div key={c.key} className="space-y-2">
            <Label htmlFor={c.key}>{c.label}</Label>
            <Input
              id={c.key}
              inputMode="decimal"
              value={valores[c.key]}
              onChange={(e) =>
                setValores((v) => ({ ...v, [c.key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Percentuais padrão usados quando não há valor específico no cadastro ou
        no mês. A distribuição Empresa/Pessoal é definida em cada entrada.
      </p>
      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Salvar parâmetros
      </Button>
    </form>
  );
}
