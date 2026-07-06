import { notFound } from "next/navigation";

import { requireProfile, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatData } from "@/lib/format";
import { PrintButton } from "@/components/recibo/print-button";
import { WhatsappButton } from "@/components/recibo/whatsapp-button";

interface PagamentoRecibo {
  id: string;
  corretor_id: string;
  data: string;
  valor_bruto: number;
  total_bonificacoes: number;
  total_adiantamentos: number;
  valor_liquido: number;
  corretores: { nome: string; telefone: string | null } | null;
}

export default async function ReciboPagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pagamentos_corretor")
    .select("*, corretores(nome, telefone)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const pagamento = data as unknown as PagamentoRecibo;

  // Corretor só vê o próprio recibo.
  const ehStaff = STAFF_ROLES.includes(profile.role);
  if (!ehStaff && profile.corretor_id !== pagamento.corretor_id) notFound();

  const [vendasRes, adiRes, bonRes] = await Promise.all([
    supabase
      .from("vendas")
      .select("id, cliente, liquido_corretor, empreendimentos(nome)")
      .eq("pagamento_id", id),
    supabase.from("adiantamentos").select("id, data, descricao, valor").eq("pagamento_id", id),
    supabase.from("bonificacoes").select("id, data, motivo, valor").eq("pagamento_id", id),
  ]);

  const vendas = (vendasRes.data ?? []) as unknown as {
    id: string;
    cliente: string | null;
    liquido_corretor: number;
    empreendimentos: { nome: string } | null;
  }[];
  const adiantamentos = (adiRes.data ?? []) as {
    id: string;
    data: string;
    descricao: string | null;
    valor: number;
  }[];
  const bonificacoes = (bonRes.data ?? []) as {
    id: string;
    data: string;
    motivo: string | null;
    valor: number;
  }[];

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10 print:p-0">
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-end gap-2">
          <WhatsappButton
            corretorNome={pagamento.corretores?.nome ?? ""}
            telefone={pagamento.corretores?.telefone ?? null}
            valor={pagamento.valor_liquido}
          />
          <PrintButton />
        </div>
        <p className="mt-2 text-right text-xs text-muted-foreground">
          Para anexar o recibo em PDF, gere-o com &quot;Imprimir / Salvar PDF&quot;
          e anexe na conversa do WhatsApp.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-8 text-zinc-900 print:border-0 print:p-0">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <div className="text-xl font-bold">Zefer Imóveis</div>
            <div className="text-sm text-zinc-500">Recibo de Pagamento</div>
          </div>
          <div className="text-right text-sm">
            <div>Data: {formatData(pagamento.data)}</div>
            <div className="text-zinc-500">Recibo nº {pagamento.id.slice(0, 8)}</div>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed">
          Recebi da <strong>Zefer Imóveis</strong> a importância de{" "}
          <strong>{formatBRL(pagamento.valor_liquido)}</strong>, referente às
          comissões e valores discriminados abaixo, dando plena e geral quitação.
        </p>

        <div className="mb-4">
          <div className="text-sm font-semibold">Corretor</div>
          <div>{pagamento.corretores?.nome ?? "—"}</div>
        </div>

        {vendas.length > 0 ? (
          <section className="mb-4">
            <div className="mb-1 text-sm font-semibold">Comissões</div>
            <table className="w-full text-sm">
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="py-1">
                      {v.empreendimentos?.nome ?? "Venda"}
                      {v.cliente ? ` — ${v.cliente}` : ""}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatBRL(v.liquido_corretor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {bonificacoes.length > 0 ? (
          <section className="mb-4">
            <div className="mb-1 text-sm font-semibold">Bonificações</div>
            <table className="w-full text-sm">
              <tbody>
                {bonificacoes.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-1">{b.motivo ?? "Bonificação"}</td>
                    <td className="py-1 text-right tabular-nums">{formatBRL(b.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {adiantamentos.length > 0 ? (
          <section className="mb-4">
            <div className="mb-1 text-sm font-semibold">Adiantamentos (descontados)</div>
            <table className="w-full text-sm">
              <tbody>
                {adiantamentos.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-1">{a.descricao ?? "Adiantamento"}</td>
                    <td className="py-1 text-right tabular-nums">- {formatBRL(a.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <div className="mt-6 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Comissões (bruto)</span>
            <span className="tabular-nums">{formatBRL(pagamento.valor_bruto)}</span>
          </div>
          <div className="flex justify-between">
            <span>(+) Bonificações</span>
            <span className="tabular-nums">{formatBRL(pagamento.total_bonificacoes)}</span>
          </div>
          <div className="flex justify-between">
            <span>(−) Adiantamentos</span>
            <span className="tabular-nums">{formatBRL(pagamento.total_adiantamentos)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Valor líquido</span>
            <span className="tabular-nums">{formatBRL(pagamento.valor_liquido)}</span>
          </div>
        </div>

        <div className="mt-16 text-center text-sm">
          <div className="mx-auto w-64 border-t border-zinc-400 pt-1">
            {pagamento.corretores?.nome ?? "Corretor"}
          </div>
        </div>
      </div>
    </div>
  );
}
