"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileCheck2, FileX2, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { salvarNotaFiscal, abrirArquivoVenda } from "@/app/(app)/vendas/actions";

const MAX_MB = 20;

/**
 * Nota fiscal da comissão, na linha da venda.
 *
 * Verde = nota anexada, e o clique abre. Vermelho = falta, e o clique já abre
 * o seletor de arquivo. O indicador fica na lista, e não escondido dentro da
 * venda, porque a pergunta que se faz aqui é "de quais vendas ainda falta a
 * nota", e isso se responde correndo o olho por uma coluna.
 */
export function NotaFiscalCelula({
  vendaId,
  path,
  podeEditar,
}: {
  vendaId: string;
  path: string | null;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const tem = Boolean(path);

  async function abrir() {
    if (!path) return;
    setOcupado(true);
    const r = await abrirArquivoVenda(path);
    setOcupado(false);
    if (r.erro || !r.url) {
      toast.error("Não foi possível abrir a nota", { description: r.erro });
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Limpa já: sem isto, escolher o mesmo arquivo de novo não dispara o evento.
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo acima de ${MAX_MB} MB.`);
      return;
    }

    setOcupado(true);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase();
    const agora = new Date();
    const destino = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, "0")}/nf-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("contratos")
      .upload(destino, file, { upsert: false, contentType: file.type });
    if (error) {
      setOcupado(false);
      toast.error("Falha ao enviar a nota", { description: error.message });
      return;
    }

    const res = await salvarNotaFiscal({ vendaId, path: destino });
    setOcupado(false);
    if (res?.error) {
      toast.error("Falha ao salvar", { description: res.error });
      return;
    }
    toast.success("Nota fiscal anexada.");
    router.refresh();
  }

  const rotulo = tem
    ? "Nota fiscal anexada — clique para abrir"
    : podeEditar
      ? "Sem nota fiscal — clique para anexar"
      : "Sem nota fiscal";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xml,image/*"
        className="hidden"
        onChange={enviar}
      />
      <button
        type="button"
        title={rotulo}
        aria-label={rotulo}
        disabled={ocupado || (!tem && !podeEditar)}
        onClick={() => (tem ? abrir() : inputRef.current?.click())}
        className="inline-flex items-center disabled:opacity-60"
      >
        {ocupado ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : tem ? (
          <FileCheck2 className="size-5 text-success" />
        ) : (
          <FileX2 className="size-5 text-destructive" />
        )}
      </button>
    </>
  );
}
