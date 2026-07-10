import { notFound } from "next/navigation";

import { requireProfile, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatData } from "@/lib/format";
import { PrintButton } from "@/components/recibo/print-button";
import { WhatsappButton } from "@/components/recibo/whatsapp-button";

interface AdiantamentoRecibo {
  id: string;
  corretor_id: string;
  data: string;
  valor: number;
  descricao: string | null;
  corretores: { nome: string; telefone: string | null } | null;
}

export default async function ReciboAdiantamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("adiantamentos")
    .select("id, corretor_id, data, valor, descricao, corretores(nome, telefone)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const adiantamento = data as unknown as AdiantamentoRecibo;

  // Corretor só vê o próprio recibo.
  const ehStaff = STAFF_ROLES.includes(profile.role);
  if (!ehStaff && profile.corretor_id !== adiantamento.corretor_id) notFound();

  const nome = adiantamento.corretores?.nome ?? "Corretor";

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
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <div className="text-xl font-bold">Zefer Imóveis</div>
            <div className="text-sm text-zinc-500">Recibo de Adiantamento (Vale)</div>
          </div>
          <div className="text-right text-sm">
            <div>Data: {formatData(adiantamento.data)}</div>
            <div className="text-zinc-500">Recibo nº {adiantamento.id.slice(0, 8)}</div>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed">
          Recebi da <strong>Zefer Imóveis</strong> a importância de{" "}
          <strong>{formatBRL(adiantamento.valor)}</strong> a título de
          adiantamento
          {adiantamento.descricao ? ` (${adiantamento.descricao})` : ""}, a ser
          descontada das minhas comissões a receber, dando plena quitação deste
          valor no acerto futuro.
        </p>

        <div className="mb-4">
          <div className="text-sm font-semibold">Corretor</div>
          <div>{nome}</div>
        </div>

        <div className="mt-6 flex justify-between border-t pt-4 text-base font-bold">
          <span>Valor do adiantamento</span>
          <span className="tabular-nums">{formatBRL(adiantamento.valor)}</span>
        </div>

        <div className="mt-16 text-center text-sm">
          <div className="mx-auto w-64 border-t border-zinc-400 pt-1">{nome}</div>
        </div>
      </div>
    </div>
  );
}
