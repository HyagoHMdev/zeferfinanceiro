"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AnexoUpload } from "@/components/anexo-upload";

/**
 * Armazena o recibo ASSINADO (upload do PDF/foto) de um adiantamento ou
 * pagamento. Reaproveita o AnexoUpload (bucket "anexos") e persiste a URL via a
 * action recebida em `salvar`. Mostra "Anexar assinado" ou o link do arquivo.
 */
export function ReciboAssinado({
  id,
  value,
  salvar,
}: {
  id: string;
  value: string | null;
  salvar: (id: string, url: string | null) => Promise<{ error?: string }>;
}) {
  const router = useRouter();

  async function onChange(url: string | null) {
    const res = await salvar(id, url);
    if (res?.error) {
      toast.error("Erro ao salvar recibo", { description: res.error });
      return;
    }
    toast.success(url ? "Recibo assinado anexado" : "Recibo removido");
    router.refresh();
  }

  return (
    <AnexoUpload value={value} onChange={onChange} pasta="recibos" label="assinado" />
  );
}
