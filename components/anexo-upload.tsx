"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Upload de um arquivo para o bucket "anexos"; devolve a URL pública. */
export function AnexoUpload({
  value,
  onChange,
  pasta,
  label = "Anexo",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  pasta: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("anexos").upload(path, file, {
      upsert: false,
    });
    if (error) {
      toast.error("Falha no upload", { description: error.message });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("anexos").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFile}
        accept="image/*,application/pdf"
      />
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Paperclip className="size-4" />
            {label} anexado
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="Remover anexo"
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
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
          Anexar {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
