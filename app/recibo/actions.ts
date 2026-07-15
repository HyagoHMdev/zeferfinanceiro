"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { error?: string };

const TABELA = {
  pagamento: "pagamentos_corretor",
  adiantamento: "adiantamentos",
} as const;

type TipoRecibo = keyof typeof TABELA;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validação de CPF (11 dígitos + dígitos verificadores). */
function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, fatorInicial: number) => {
    let soma = 0;
    let fator = fatorInicial;
    for (const c of base) soma += Number(c) * fator--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return (
    calc(d.slice(0, 9), 10) === Number(d[9]) &&
    calc(d.slice(0, 10), 11) === Number(d[10])
  );
}

/**
 * O corretor preenche o próprio CPF pelo link público do recibo. Salva no
 * cadastro do corretor (via admin), APENAS se ainda estiver vazio — não
 * sobrescreve um CPF já cadastrado (evita adulteração).
 */
export async function salvarCpfCorretor(
  corretorId: string,
  cpf: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(corretorId)) return { error: "Corretor inválido." };
  const d = (cpf ?? "").replace(/\D/g, "");
  if (!cpfValido(d)) return { error: "CPF inválido." };
  const formatado = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

  const supabase = createAdminClient();
  const { data: atual, error: selErr } = await supabase
    .from("corretores")
    .select("cpf")
    .eq("id", corretorId)
    .single();
  if (selErr || !atual) return { error: "Corretor não encontrado." };
  if (atual.cpf && String(atual.cpf).trim()) {
    return { error: "Este corretor já tem CPF cadastrado." };
  }

  const { error } = await supabase
    .from("corretores")
    .update({ cpf: formatado })
    .eq("id", corretorId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Assinatura digital de um recibo pelo link público (sem login). Recebe a
 * assinatura desenhada (PNG em base64), grava a imagem no Storage e registra o
 * aceite (data/hora + IP). Usa cliente admin porque a página é pública. Não
 * permite reassinar um recibo já assinado.
 */
export async function assinarRecibo(
  tipo: TipoRecibo,
  id: string,
  assinaturaBase64: string,
): Promise<ActionResult> {
  const tabela = TABELA[tipo];
  if (!tabela) return { error: "Tipo de recibo inválido." };
  if (!UUID_RE.test(id)) return { error: "Recibo inválido." };

  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(
    assinaturaBase64 ?? "",
  );
  if (!match) return { error: "Assinatura inválida." };
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length === 0) return { error: "Assinatura vazia." };
  if (buffer.length > 600_000) return { error: "Assinatura muito grande." };

  const supabase = createAdminClient();

  // Já assinado? Não permite reassinar (integridade do recibo).
  const { data: atual, error: selErr } = await supabase
    .from(tabela)
    .select("assinado_em")
    .eq("id", id)
    .single();
  if (selErr || !atual) return { error: "Recibo não encontrado." };
  if (atual.assinado_em) return { error: "Este recibo já foi assinado." };

  // Sobe a imagem da assinatura no bucket público.
  const path = `assinaturas/${crypto.randomUUID()}.png`;
  const up = await supabase.storage
    .from("anexos")
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (up.error) return { error: up.error.message };
  const { data: pub } = supabase.storage.from("anexos").getPublicUrl(path);

  const hdrs = await headers();
  const ip =
    (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    hdrs.get("x-real-ip") ||
    null;

  // Grava o aceite; a condição is(assinado_em, null) evita corrida (dupla assinatura).
  const { data: upd, error } = await supabase
    .from(tabela)
    .update({
      assinatura_url: pub.publicUrl,
      assinado_em: new Date().toISOString(),
      assinado_ip: ip,
    })
    .eq("id", id)
    .is("assinado_em", null)
    .select("id");
  if (error) return { error: error.message };
  if (!upd || upd.length === 0) return { error: "Este recibo já foi assinado." };

  revalidatePath(`/recibo/${tipo}/${id}`);
  return {};
}
