"use client";

import { MessageCircle } from "lucide-react";

import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** Normaliza um telefone BR para o formato do wa.me (só dígitos, com DDI 55). */
function numeroWhatsapp(tel: string | null | undefined): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55")) return d; // já tem o DDI do Brasil
  if (d.length === 10 || d.length === 11) return `55${d}`; // DDD + número
  return d; // outros formatos: usa como veio
}

/**
 * Abre o WhatsApp com uma mensagem pronta (valor + link deste recibo). Se o
 * corretor tiver telefone cadastrado, abre direto a conversa com ele; senão,
 * usa wa.me sem número e a pessoa escolhe o contato. O link do recibo é o da
 * própria página (lido no clique).
 */
export function WhatsappButton({
  corretorNome,
  telefone,
  valor,
  assunto = "pagamento",
}: {
  corretorNome: string;
  telefone?: string | null;
  valor: number;
  /** Palavra usada na mensagem: "pagamento" (padrão) ou "adiantamento". */
  assunto?: string;
}) {
  function enviar() {
    const primeiroNome = corretorNome.trim().split(/\s+/)[0] ?? "";
    const saudacao = primeiroNome ? `Olá ${primeiroNome}! ` : "Olá! ";
    const mensagem =
      `${saudacao}Segue o recibo do seu ${assunto} no valor de ${formatBRL(valor)}.\n\n` +
      `Acesse aqui: ${window.location.href}`;
    const texto = encodeURIComponent(mensagem);
    const num = numeroWhatsapp(telefone);
    const url = num
      ? `https://wa.me/${num}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      type="button"
      onClick={enviar}
      className="bg-[#25D366] text-white hover:bg-[#1ebe57] print:hidden"
    >
      <MessageCircle className="size-4" />
      Enviar por WhatsApp
    </Button>
  );
}
