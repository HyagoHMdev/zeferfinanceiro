"use client";

import { MessageCircle } from "lucide-react";

import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * Abre o WhatsApp com uma mensagem pronta (valor + link deste recibo). Como o
 * corretor não tem telefone cadastrado, usa wa.me sem número — quem envia
 * escolhe o contato. O link do recibo é o da própria página (lido no clique).
 */
export function WhatsappButton({
  corretorNome,
  valor,
}: {
  corretorNome: string;
  valor: number;
}) {
  function enviar() {
    const primeiroNome = corretorNome.trim().split(/\s+/)[0] ?? "";
    const saudacao = primeiroNome ? `Olá ${primeiroNome}! ` : "Olá! ";
    const mensagem =
      `${saudacao}Segue o recibo do seu pagamento no valor de ${formatBRL(valor)}.\n\n` +
      `Acesse aqui: ${window.location.href}`;
    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
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
