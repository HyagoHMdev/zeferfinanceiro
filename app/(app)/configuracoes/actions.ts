"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import type { AppRole, PercentualChave } from "@/lib/types";

type ActionResult = { error?: string };

const TABELAS_PERMITIDAS = new Set([
  "construtoras",
  "empreendimentos",
  "corretores",
  "parceiros",
  "contas_bancarias",
  "centros_custo",
  "fornecedores",
  "categorias_financeiras",
]);

function revalidar() {
  revalidatePath("/configuracoes", "layout");
  revalidatePath("/vendas", "layout");
  revalidatePath("/financeiro", "layout");
}

export async function salvarCadastro(
  tabela: string,
  id: string | null,
  dados: Record<string, unknown>,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!TABELAS_PERMITIDAS.has(tabela)) return { error: "Tabela inválida." };

  const supabase = await createClient();
  const res = id
    ? await supabase.from(tabela).update(dados).eq("id", id)
    : await supabase.from(tabela).insert(dados);
  if (res.error) return { error: res.error.message };

  revalidar();
  return {};
}

export async function excluirCadastro(
  tabela: string,
  id: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!TABELAS_PERMITIDAS.has(tabela)) return { error: "Tabela inválida." };

  const supabase = await createClient();
  const res = await supabase.from(tabela).delete().eq("id", id);
  if (res.error) {
    return {
      error:
        "Não foi possível excluir (pode estar em uso). Tente desativar em vez de excluir.",
    };
  }

  revalidar();
  return {};
}

const parametrosSchema = z.object({
  percentual_comissao_padrao: z.number().min(0).max(1),
  percentual_parceiro_padrao: z.number().min(0).max(1),
  percentual_imposto_imobiliaria: z.number().min(0).max(1),
  percentual_imposto_nf_corretor: z.number().min(0).max(1),
  percentual_comissao_corretor_padrao: z.number().min(0).max(1),
  percentual_dizimo: z.number().min(0).max(1),
  percentual_distribuicao_empresa: z.number().min(0).max(1),
  percentual_distribuicao_pessoal: z.number().min(0).max(1),
});

export async function salvarParametros(
  dados: z.infer<typeof parametrosSchema>,
): Promise<ActionResult> {
  await requireRole(["admin", "financeiro"]);
  const parsed = parametrosSchema.safeParse(dados);
  if (!parsed.success) return { error: "Valores inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update(parsed.data)
    .eq("id", true);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes", "layout");
  return {};
}

const usuarioSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
  nome: z.string().trim().min(1),
  role: z.enum(["admin", "financeiro", "diretor", "corretor"]),
  corretor_id: z.string().uuid().nullable(),
});

export async function criarUsuario(
  input: z.infer<typeof usuarioSchema>,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = usuarioSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados do usuário inválidos." };
  const u = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.senha,
    email_confirm: true,
    user_metadata: { nome: u.nome },
  });
  if (error || !data.user) return { error: error?.message ?? "Falha ao criar usuário." };

  // O trigger já criou o profile; ajustamos papel e vínculo.
  const { error: upErr } = await admin
    .from("profiles")
    .update({ nome: u.nome, role: u.role, corretor_id: u.corretor_id, ativo: true })
    .eq("id", data.user.id);
  if (upErr) return { error: upErr.message };

  revalidatePath("/configuracoes", "layout");
  return {};
}

export async function atualizarPerfil(
  id: string,
  role: AppRole,
  corretorId: string | null,
  ativo: boolean,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, corretor_id: corretorId, ativo })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes", "layout");
  return {};
}

const CHAVES_VALIDAS: PercentualChave[] = [
  "comissao_construtora",
  "repasse_parceiro",
  "comissao_corretor",
  "imposto_nf_corretor",
  "imposto_imobiliaria",
  "dizimo",
];

function revalidarPercentuais() {
  revalidatePath("/configuracoes", "layout");
  revalidatePath("/vendas", "layout");
  revalidatePath("/entradas");
}

/** Salva (substitui) os percentuais de um mês para uma entidade (ou global). */
export async function salvarMesPercentuais(
  entidadeId: string | null,
  competenciaYYYYMM: string,
  valores: { chave: PercentualChave; percentual: number }[],
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  if (!/^\d{4}-\d{2}$/.test(competenciaYYYYMM)) return { error: "Mês inválido." };
  const competencia = `${competenciaYYYYMM}-01`;
  const itens = valores.filter(
    (v) => CHAVES_VALIDAS.includes(v.chave) && Number.isFinite(v.percentual),
  );
  if (itens.length === 0) return { error: "Informe ao menos um percentual." };

  const supabase = await createClient();
  const chaves = itens.map((i) => i.chave);

  let del = supabase
    .from("percentuais_mensais")
    .delete()
    .eq("competencia", competencia)
    .in("chave", chaves);
  del = entidadeId ? del.eq("entidade_id", entidadeId) : del.is("entidade_id", null);
  const { error: delErr } = await del;
  if (delErr) return { error: delErr.message };

  const { error } = await supabase.from("percentuais_mensais").insert(
    itens.map((i) => ({
      chave: i.chave,
      entidade_id: entidadeId,
      competencia,
      percentual: i.percentual,
    })),
  );
  if (error) return { error: error.message };

  revalidarPercentuais();
  return {};
}

/** Remove os percentuais de um mês para uma entidade (ou global). */
export async function excluirMesPercentuais(
  entidadeId: string | null,
  competenciaYYYYMM: string,
  chaves: PercentualChave[],
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const competencia = `${competenciaYYYYMM}-01`;
  const supabase = await createClient();

  let del = supabase
    .from("percentuais_mensais")
    .delete()
    .eq("competencia", competencia)
    .in("chave", chaves);
  del = entidadeId ? del.eq("entidade_id", entidadeId) : del.is("entidade_id", null);
  const { error } = await del;
  if (error) return { error: error.message };

  revalidarPercentuais();
  return {};
}
