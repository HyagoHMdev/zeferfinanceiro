import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL, formatData, valorPorExtenso } from "@/lib/format";
import { PrintButton } from "@/components/recibo/print-button";
import { WhatsappButton } from "@/components/recibo/whatsapp-button";
import { AssinaturaRecibo } from "@/components/recibo/assinatura-recibo";

const EMPRESA_NOME = "ZEFER INVESTIMENTOS IMOBILIARIOS LTDA";
const EMPRESA_CNPJ = "55.901.792/0001-67";

interface AdiantamentoRecibo {
  id: string;
  corretor_id: string;
  data: string;
  valor: number;
  descricao: string | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  corretores: {
    nome: string;
    telefone: string | null;
    cpf: string | null;
    creci: string | null;
  } | null;
}

export default async function ReciboAdiantamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Público (link do WhatsApp): cliente admin busca só este recibo pelo UUID.
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("adiantamentos")
    .select(
      "id, corretor_id, data, valor, descricao, assinatura_url, assinado_em, corretores(nome, telefone, cpf, creci)",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const adiantamento = data as unknown as AdiantamentoRecibo;

  const nome = adiantamento.corretores?.nome ?? "Corretor";
  const cpf = adiantamento.corretores?.cpf?.trim() || "________________";
  const creci = adiantamento.corretores?.creci?.trim() || "________";

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10 print:p-0">
      <div className="mb-6 flex items-center justify-end gap-2 print:hidden">
        <WhatsappButton
          corretorNome={nome}
          telefone={adiantamento.corretores?.telefone ?? null}
          valor={adiantamento.valor}
          assunto="adiantamento"
        />
        <PrintButton />
      </div>

      <div className="rounded-lg border bg-white p-8 text-zinc-900 print:border-0 print:p-0">
        <div className="mb-8 flex items-center justify-between border-b pb-4">
          <div>
            <div className="text-xl font-bold">Zefer Imóveis</div>
            <div className="text-sm text-zinc-500">Recibo de Adiantamento (Vale)</div>
          </div>
          <div className="text-right text-sm">
            <div>Data: {formatData(adiantamento.data)}</div>
            <div className="text-zinc-500">Recibo nº {adiantamento.id.slice(0, 8)}</div>
          </div>
        </div>

        <p className="text-justify text-sm leading-7">
          Eu, <strong>{nome.toUpperCase()}</strong>, inscrito no CPF sob nº {cpf} e
          CRECI {creci}, declaro ter recebido da empresa{" "}
          <strong>{EMPRESA_NOME}</strong>, pessoa jurídica de direito privado,
          inscrita no CNPJ sob nº {EMPRESA_CNPJ}, nesta data, a quantia de{" "}
          <strong>{formatBRL(adiantamento.valor)}</strong> (
          {valorPorExtenso(adiantamento.valor)}), a título de adiantamento.
          Declaro ainda estar ciente e de acordo que referido valor será
          descontado integralmente da próxima comissão que eu venha a receber. Por
          ser verdade, firmo o presente recibo.
        </p>

        <AssinaturaRecibo
          tipo="adiantamento"
          id={adiantamento.id}
          nome={nome.toUpperCase()}
          subtitulo={`CPF ${cpf}`}
          assinaturaUrl={adiantamento.assinatura_url}
          assinadoEm={adiantamento.assinado_em}
        />
      </div>
    </div>
  );
}
