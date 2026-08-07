import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Atribuição da venda: de onde o cliente veio e quando falou com a Zefer pela
 * primeira vez.
 *
 * Os leads moram em public.leads (schema do painel, alimentado pelo Bitrix),
 * por isso o client admin com .schema("public").
 */
export interface LeadDaVenda {
  id: string;
  nome: string | null;
  fonte: string | null;
  origem: string | null;
  origemForm: string | null;
  utm: string | null;
  campanhaId: string | null;
  primeiroContato: string;
}

type LinhaLead = {
  id: string;
  nome: string | null;
  fonte: string | null;
  origem: string | null;
  origem_form: string | null;
  utm: string | null;
  campanha_id: string | null;
  created_at: string;
};

const CAMPOS = "id,nome,fonte,origem,origem_form,utm,campanha_id,created_at";

const mapear = (r: LinhaLead): LeadDaVenda => ({
  id: r.id,
  nome: r.nome,
  fonte: r.fonte,
  origem: r.origem,
  origemForm: r.origem_form,
  utm: r.utm,
  campanhaId: r.campanha_id,
  primeiroContato: r.created_at,
});

/**
 * Mesma regra da função public.telefone_chave, do lado do app: DDD + os 8
 * últimos dígitos.
 *
 * O lead vem do Bitrix em E.164 ("+5547999224898") e o corretor digita como
 * quiser ("47 99922-4898"), então texto cru nunca casaria. Os 8 últimos, e não
 * 9, porque o nono dígito dos celulares foi acrescentado depois e cadastro
 * antigo pode não ter.
 */
export function telefoneChave(t: string | null | undefined): string | null {
  let n = (t ?? "").replace(/\D/g, "");
  // Tira o 55 só quando sobra tamanho plausível: um fixo de SP ("5511...")
  // começa com 55 e não pode ser decapitado.
  if (n.length >= 12 && n.startsWith("55")) n = n.slice(2);
  return n.length >= 10 ? n.slice(0, 2) + n.slice(-8) : null;
}

/**
 * Acha o lead pelo telefone do cliente.
 *
 * Com mais de um lead no mesmo número fica o MAIS ANTIGO: a pergunta é quando
 * o cliente chegou, e contato repetido é o mesmo cliente voltando.
 */
export async function acharLeadPorTelefone(
  telefone: string | null,
): Promise<LeadDaVenda | null> {
  const chave = telefoneChave(telefone);
  if (!chave) return null;

  const { data } = await createAdminClient()
    .schema("public")
    .from("leads")
    .select(CAMPOS)
    .eq("telefone_chave", chave)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<LinhaLead>();

  return data ? mapear(data) : null;
}

/** Lead já vinculado a uma venda. */
export async function buscarLead(leadId: string | null): Promise<LeadDaVenda | null> {
  if (!leadId) return null;
  const { data } = await createAdminClient()
    .schema("public")
    .from("leads")
    .select(CAMPOS)
    .eq("id", leadId)
    .maybeSingle<LinhaLead>();
  return data ? mapear(data) : null;
}
