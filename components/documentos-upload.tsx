"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, X, FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { abrirArquivoVenda } from "@/app/(app)/vendas/actions";

const MAX_MB = 20;
const MAX_ARQUIVOS = 20;

export type DocumentoVenda = { path: string; nome: string };

/**
 * Documentos do cliente (RG, CPF, comprovante de renda...).
 *
 * Vários arquivos, ao contrário do contrato, que é um só. Guarda o nome
 * original junto do caminho: sem ele a lista seria um monte de UUID e ninguém
 * saberia qual é qual.
 *
 * Mesmo bucket privado do contrato, sob o prefixo `documentos/`. Documento de
 * identidade é pelo menos tão sensível quanto o contrato, então a visualização
 * também passa por URL assinada com validade curta.
 */
export function DocumentosUpload({
  value,
  onChange,
}: {
  value: DocumentoVenda[];
  onChange: (docs: DocumentoVenda[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Limpa o input já: sem isto, escolher o mesmo arquivo de novo não dispara
    // o onChange e parece que o botão travou.
    e.target.value = "";
    if (files.length === 0) return;

    if (value.length + files.length > MAX_ARQUIVOS) {
      toast.error(`Máximo de ${MAX_ARQUIVOS} documentos por venda.`);
      return;
    }
    const grande = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (grande) {
      toast.error(`"${grande.name}" passa de ${MAX_MB} MB.`, {
        description: "Reduza a qualidade do escaneamento.",
      });
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const agora = new Date();
    const pasta = `documentos/${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, "0")}`;
    const novos: DocumentoVenda[] = [];

    for (const file of files) {
      const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase();
      const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("contratos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        // Um arquivo que falha não descarta os que já subiram.
        toast.error(`Falha em "${file.name}"`, { description: error.message });
        continue;
      }
      novos.push({ path, nome: file.name.slice(0, 200) });
    }

    setEnviando(false);
    if (novos.length > 0) {
      onChange([...value, ...novos]);
      toast.success(
        novos.length === 1 ? "Documento anexado." : `${novos.length} documentos anexados.`,
      );
    }
  }

  async function ver(doc: DocumentoVenda) {
    setAbrindo(doc.path);
    const r = await abrirArquivoVenda(doc.path);
    setAbrindo(null);
    if (r.erro || !r.url) {
      toast.error("Não foi possível abrir", { description: r.erro });
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={enviar}
        accept="application/pdf,image/jpeg,image/png,image/webp"
      />

      {value.length > 0 && (
        <ul className="space-y-1 rounded-md border p-2">
          {value.map((d) => (
            <li key={d.path} className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => ver(d)}
                disabled={abrindo === d.path}
                className="inline-flex min-w-0 items-center gap-2 text-left hover:underline disabled:opacity-50"
              >
                {abrindo === d.path ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{d.nome}</span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(value.filter((x) => x.path !== d.path))}
                aria-label={`Remover ${d.nome}`}
                title="Desvincula da venda. O arquivo continua guardado."
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={enviando || value.length >= MAX_ARQUIVOS}
      >
        {enviando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Paperclip className="size-4" />
        )}
        Anexar documentos
      </Button>

      <p className="text-xs text-muted-foreground">
        RG, CPF, comprovante de renda e o que mais precisar. PDF ou imagem, até{" "}
        {MAX_MB} MB cada. Dá para selecionar vários de uma vez. Fica em área
        restrita, não em link público.
      </p>
    </div>
  );
}
