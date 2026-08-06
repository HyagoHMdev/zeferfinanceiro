"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, FileText, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { abrirArquivoVenda } from "@/app/(app)/vendas/actions";

const MAX_MB = 20;

/**
 * Upload do contrato para o bucket PRIVADO `contratos`.
 *
 * Diferente do AnexoUpload: aquele grava no bucket público e devolve URL
 * pública. Contrato tem CPF, valores e assinatura, então aqui o componente
 * guarda só o CAMINHO, e a visualização passa por uma URL assinada gerada no
 * servidor, que expira.
 */
export function ContratoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo acima de ${MAX_MB} MB.`, {
        description: "Reduza a qualidade do escaneamento ou divida em partes.",
      });
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase();
    // Prefixo por ano/mês para a pasta não virar um monte só com o tempo.
    const agora = new Date();
    const path = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("contratos")
      .upload(path, file, { upsert: false, contentType: file.type });
    setEnviando(false);

    if (error) {
      toast.error("Falha ao enviar o contrato", { description: error.message });
      return;
    }
    onChange(path);
    toast.success("Contrato anexado.");
  }

  async function ver() {
    if (!value) return;
    setAbrindo(true);
    const r = await abrirArquivoVenda(value);
    setAbrindo(false);
    if (r.erro || !r.url) {
      toast.error("Não foi possível abrir", { description: r.erro });
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={enviar}
        accept="application/pdf,image/jpeg,image/png,image/webp"
      />
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <Button type="button" variant="outline" size="sm" onClick={ver} disabled={abrindo}>
            {abrindo ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Ver contrato
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="Remover contrato"
            title="Desvincula da venda. O arquivo continua guardado."
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
        >
          {enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          Anexar contrato
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        PDF ou imagem, até {MAX_MB} MB. Fica em área restrita, não em link público.
      </p>
    </div>
  );
}
